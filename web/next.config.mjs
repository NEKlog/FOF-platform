/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Peg den “gamle” sti over på den nye rute:
      { source: '/api/admin/tasks/:id/status', destination: '/api/admin/task-status/:id' },
    ];
  },
};

export default nextConfig;
