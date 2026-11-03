import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

let isConnected = false;

// Configure custom DNS resolvers if explicitly defined (e.g. DNS_SERVERS=8.8.8.8,1.1.1.1)
if (process.env.DNS_SERVERS) {
  const customServers = process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (customServers.length > 0) {
    try {
      dns.setServers(customServers);
      console.log(`ℹ Configured custom Node.js DNS servers for MongoDB queries: ${customServers.join(', ')}`);
    } catch (e) {
      console.warn('Could not set custom DNS servers:', e.message);
    }
  }
}

/**
 * Centralized MongoDB Connection Manager using Mongoose.
 * Configured using the MONGODB_URI environment variable with automatic retry logic
 * and DNS resolver fallback for MongoDB Atlas SRV clusters.
 */
export async function connectMongo(explicitUri = null, maxRetries = 3) {
  const uri = explicitUri || process.env.MONGODB_URI;

  if (!uri) {
    if (process.env.NODE_ENV === 'test') {
      console.log('ℹ Test mode: Running in isolated test environment without external MONGODB_URI');
      return mongoose.connection;
    }
    const errorMsg = 'MONGODB_URI environment variable is not defined. Please configure a valid MongoDB Atlas connection string.';
    console.error('MongoDB connection configuration error:', errorMsg);
    throw new Error(errorMsg);
  }

  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  // Prevent multiple simultaneous connection attempts
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
    });
    isConnected = true;
    return mongoose.connection;
  }

  // Attach event listeners only once
  if (mongoose.connection.listenerCount('connected') === 0) {
    mongoose.connection.on('connected', () => {
      isConnected = true;
      console.log('✓ Successfully connected to MongoDB Atlas via Mongoose');
    });

    mongoose.connection.on('error', (err) => {
      isConnected = false;
      console.error('MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('MongoDB disconnected. Attempting automatic reconnection...');
    });

    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      console.log('✓ MongoDB reconnected successfully');
    });
  }

  const connectOptions = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    family: 4 // Prefer IPv4 to avoid dual-stack DNS timeouts on local networks
  };

  const attempts = process.env.NODE_ENV === 'test' ? 1 : maxRetries;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await mongoose.connect(uri, connectOptions);
      isConnected = true;
      return mongoose.connection;
    } catch (err) {
      lastError = err;
      isConnected = false;

      const isSrvDnsError = err.code === 'EBADRESP' ||
        (err.message && (err.message.includes('querySrv EBADRESP') || err.message.includes('querySrv ENODATA')));
      const isTlsAlert = err.message && (err.message.includes('SSL alert number 80') || err.message.includes('tlsv1 alert internal error'));

      // If SRV lookup failed due to local DNS returning EBADRESP, try switching Node.js DNS servers to Google and Cloudflare
      if (isSrvDnsError && attempt === 1 && !process.env.DNS_SERVERS) {
        try {
          dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
          console.warn('⚠ Local DNS returned EBADRESP on SRV lookup. Switched Node.js DNS servers to [8.8.8.8, 1.1.1.1] for retry...');
        } catch (_) {}
      }

      if (attempt < attempts) {
        const delay = attempt * 1500;
        console.warn(`⚠ MongoDB connection attempt ${attempt}/${attempts} failed (${err.message}). Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // If all attempts failed, log structured diagnostic advice
  if (lastError) {
    if (lastError.code === 'EBADRESP' || (lastError.message && lastError.message.includes('querySrv EBADRESP'))) {
      console.error('\n========================================================================');
      console.error('DIAGNOSIS: DNS querySrv EBADRESP for MongoDB Atlas SRV Connection String');
      console.error('------------------------------------------------------------------------');
      console.error('Root Cause: Your local DNS resolver, home Wi-Fi router, or ISP returned');
      console.error('an invalid response for the SRV DNS query (_mongodb._tcp).');
      console.error('This is an external network/DNS issue, not an application code bug.');
      console.error('\nSOLUTIONS TO RESOLVE:');
      console.error('1. Standard Connection String (Recommended): In MongoDB Atlas:');
      console.error('   Click "Connect" -> "Drivers" -> Choose "Node.js 2.2.12 or earlier" (Standard connection string)');
      console.error('   Format: mongodb://user:pass@host1:27017,host2:27017,host3:27017/civictrack?ssl=true&replicaSet=atlas-xxx&authSource=admin');
      console.error('   This directly connects via standard A-record hostnames and bypasses SRV.');
      console.error('2. Set DNS_SERVERS: Add DNS_SERVERS=8.8.8.8,1.1.1.1 in your server/.env file.');
      console.error('3. Windows DNS: In Windows Network Adapter settings, set IPv4 DNS to 8.8.8.8.');
      console.error('========================================================================\n');
    } else if (lastError.message && (lastError.message.includes('SSL alert number 80') || lastError.message.includes('tlsv1 alert internal error'))) {
      console.error('\n========================================================================');
      console.error('DIAGNOSIS: MongoDB Atlas TLS Alert 80 (Connection Handshake Rejected)');
      console.error('------------------------------------------------------------------------');
      console.error('Root Cause: The current public IP is not in MongoDB Atlas Network Access.');
      console.error('ACTION REQUIRED:');
      console.error('Log in to https://cloud.mongodb.com -> Network Access -> Add IP Address:');
      console.error('  - Add your current IP or add 0.0.0.0/0 (Allow Access from Anywhere).');
      console.error('========================================================================\n');
    } else {
      console.error('Failed to establish MongoDB Atlas connection after retries:', lastError.message);
    }
    throw lastError;
  }
}

/**
 * Disconnects from MongoDB cleanly.
 */
export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('✓ Disconnected from MongoDB');
  }
}

/**
 * Retrieves the current connection status.
 */
export function getMongoStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    readyState: mongoose.connection.readyState,
    isConnected: mongoose.connection.readyState === 1
  };
}

// Graceful application shutdown handling
process.on('SIGINT', async () => {
  try {
    await disconnectMongo();
    process.exit(0);
  } catch (_) {
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  try {
    await disconnectMongo();
    process.exit(0);
  } catch (_) {
    process.exit(1);
  }
});

export default {
  connectMongo,
  disconnectMongo,
  getMongoStatus
};
