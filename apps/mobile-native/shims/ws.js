// React Native provides WebSocket as a global — shim ws for Node-targeting packages (e.g. @supabase/realtime-js)
module.exports = global.WebSocket;
