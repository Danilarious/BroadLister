export const config = {
  host: process.env.BROADLISTER_API_HOST ?? "127.0.0.1",
  port: Number(process.env.BROADLISTER_API_PORT ?? "3021"),
  databaseUrl: process.env.BROADLISTER_DB ?? "file:/home/bxby/development/BroadLister/data/broadlister.sqlite"
};
