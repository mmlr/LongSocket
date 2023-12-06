# LongSocket
A TCP to HTTP proxy with a WebSocket compatible API.

The requests are done via POSTs to the backend server so that they can work over
proxies that don't support WebSockets. This is a lot less efficient than
WebSockets due to the overhead of the individual requests but easy to proxy.

## noVNC Demo
A wrapped version of noVNC is built into the server container image and
reachable at `http://localhost:8915/novnc.html`.

As an example the LongSocket can be either provided as the raw transport for the
RFB class, or LongSocket can replace WebSocket completely by assigning
`WebSocket = LongSocket` globally.

Note that here, the target VNC server is connected to via TCP and not via
WebSockets.
