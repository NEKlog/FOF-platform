module.exports = {
  apps: [
    {
      name: 'dev',
      cwd: './client',
      script: 'cmd',
      args: ['/c', 'npm run dev'],
      exec_interpreter: 'none',
      exec_mode: 'fork'
    }
  ]
};
