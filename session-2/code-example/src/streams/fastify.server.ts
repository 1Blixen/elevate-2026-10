import Fastify from "fastify";
const app = Fastify({
  logger: true,
});

app.get("/", (request, reply) => {
  reply.send({ hello: "world" });
});

app.listen({ port: 3000 });

app.post(
  "/users",
  {
    schema: {
      body: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1 },
        },
      },
      response: {
        201: {
          type: "object",
          properties: {
            id: { type: "integer" },
            name: { type: "string" },
          },
        },
      },
    },
  },
  async (request, reply) => {
    const body = request.body as { name: string };

    reply.code(201);
    return { id: 1, name: body.name };
  },
);
