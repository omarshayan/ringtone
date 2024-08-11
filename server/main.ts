let host_list: any[] = [];

Deno.serve({
  port: 80,
  handler: async (request) => {
    // If the request is a websocket upgrade,
    // we need to use the Deno.upgradeWebSocket helper
    if (request.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(request);

      socket.onopen = () => {
        console.log("CONNECTED");
      };
      socket.onmessage = (event) => {
        console.log(`RECEIVED: ${event.data}`);
        const message_obj = JSON.parse(event.data);

        console.log("got a message from the client", message_obj);
        if (message_obj.type == "host_request") {
          host_list.push(message_obj.hoster_name);
          
          console.log("host list: ", host_list)
        }
      };
      socket.onclose = () => console.log("DISCONNECTED");
      socket.onerror = (error) => console.error("ERROR:", error);

      return response;
    } else {
      // If the request is a normal HTTP request,
      // we serve the client HTML file.
      const file = await Deno.open("./client/index.html", { read: true });
      return new Response(file.readable);
    }
  },
});

