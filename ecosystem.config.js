module.exports = {
  apps: [
    {
      name: "server",
      script: "server.js",
      env: {
        NODE_ENV: "production",
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      time: true,
    },
  ],
};
