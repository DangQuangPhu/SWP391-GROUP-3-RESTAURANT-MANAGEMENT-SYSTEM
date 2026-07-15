import net from 'net';

const hosts = ['127.0.0.1', 'localhost', '::1'];
const port = 1433;

hosts.forEach(host => {
  const socket = new net.Socket();
  console.log(`Checking connection to ${host}:${port}...`);
  
  socket.setTimeout(2000);
  
  socket.on('connect', () => {
    console.log(`✅ SUCCESS: Connected to ${host}:${port}`);
    socket.destroy();
  });
  
  socket.on('error', (err) => {
    console.log(`❌ FAILED: ${host}:${port} -> ${err.message}`);
  });
  
  socket.on('timeout', () => {
    console.log(`⏳ TIMEOUT: ${host}:${port}`);
    socket.destroy();
  });
  
  socket.connect(port, host);
});
