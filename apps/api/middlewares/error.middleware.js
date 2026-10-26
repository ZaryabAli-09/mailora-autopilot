export function errorMiddleware(error, _req, res, _next) {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.statusCode ? error.message : "Something went wrong",
  });
}
