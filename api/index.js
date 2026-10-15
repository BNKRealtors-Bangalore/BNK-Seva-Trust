"use strict";

module.exports = async (request, response) => {
  // Loading here lets initialization failures return JSON instead of a function crash page.
  try {
    await require("../server.cjs").handleRequest(request, response);
  } catch (error) {
    console.error("API initialization failed:", error.message);
    response.statusCode = 503;
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify({ error: "The backend could not start. Check the database configuration in Vercel." }));
  }
};
