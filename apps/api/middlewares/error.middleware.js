export function errorMiddleware(error, req, res, _next) {
  console.error("API request failed", { path: req.path, name: error.name, statusCode: error.statusCode || 500 });
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Something went wrong",
    ...(error.code && typeof error.code === "string" ? { code: error.code } : {}),
  });
}
