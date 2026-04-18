declare module "localtunnel" {
  interface TunnelHandle {
    url: string;
    closed: boolean;
    close(): void;
    on(event: string, cb: (err?: unknown) => void): void;
  }
  function localtunnel(opts: { port: number; subdomain?: string }): Promise<TunnelHandle>;
  export default localtunnel;
}
