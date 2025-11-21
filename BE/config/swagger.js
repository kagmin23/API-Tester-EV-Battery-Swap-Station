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
        schemas: {
            SubscriptionPlan: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    subscriptionName: { type: 'string' },
                    price: { type: 'number' },
                    durations: { type: 'integer' },
                    type: { type: 'string', enum: ['change', 'periodic'] },
                    count_swap: { type: ['integer', 'null'] },
                    quantity_slot: { type: ['integer', 'null'] },
                    description: { type: 'string' },
                }
            },
            UserSubscription: {
                type: 'object',
                properties: {
                    _id: { type: 'string' },
                    user: { type: 'string' },
                    plan: { type: 'string' },
                    start_date: { type: 'string', format: 'date-time' },
                    end_date: { type: 'string', format: 'date-time' },
                    remaining_swaps: { type: ['integer', 'null'] },
                    status: { type: 'string' },
                    monthly_day: { type: 'string', format: 'date-time', description: 'ISO date representing initial monthly swap selection (use day-of-month 1-28)' },
                    last_reserved_month: { type: 'string', description: 'YYYY-MM of last reservation' },
                    station: { type: 'string', description: 'station id where periodic reservation should be created' }
                }
            }
        }
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


