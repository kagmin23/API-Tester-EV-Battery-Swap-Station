const path = require("path");
const swaggerJSDoc = require("swagger-jsdoc");

const port = process.env.PORT || 3000;

const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
        title: "EV Battery Swap Station API",
        version: "1.0.0",
        description: "Swagger UI documentation for the EV Battery Swap Station backend.",
    },
    servers: [
        {
            url: `http://localhost:${port}`,
            description: "Local server",
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
    },
    security: [
        {
            bearerAuth: [],
        },
    ],
};

const apisGlobs = [
    path.join(__dirname, "..", "routes", "**", "*.js"),
    path.join(__dirname, "..", "controllers", "**", "*.js"),
];

const swaggerSpecs = swaggerJSDoc({ definition: swaggerDefinition, apis: apisGlobs });

module.exports = swaggerSpecs;


