// Vercel serverless entry point.
//
// Vercel has no persistent local disk, so credentials live in /tmp and reset
// when the instance is recycled. Set a stable AUTH_SECRET in the Vercel project
// so sessions survive as long as the data directory does. For durable accounts,
// point AUTH_DATA_DIR at a persistent store or move the database to a real
// database service.
process.env.AUTH_DATA_DIR ||= '/tmp'
process.env.AUTH_COOKIE_SECURE ||= 'true'

const { createRequestHandler } = await import('./index.mjs')

export default createRequestHandler()