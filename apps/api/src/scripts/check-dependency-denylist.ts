import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const denied = [
  "nodemailer",
  "@sendgrid/mail",
  "mailgun.js",
  "@aws-sdk/client-ses",
  "postmark",
  "resend",
  "mailersend",
  "sparkpost"
];

const { stdout } = await execFileAsync("pnpm", ["list", "--depth", "20", "--json"], {
  cwd: process.cwd(),
  maxBuffer: 1024 * 1024 * 10
});

const tree = stdout.toLowerCase();
const found = denied.filter((name) => tree.includes(`"name":"${name.toLowerCase()}"`) || tree.includes(`/${name.toLowerCase()}@`));

if (found.length > 0) {
  console.error(`Denied send-side dependencies found: ${found.join(", ")}`);
  process.exit(1);
}

console.log("Dependency deny-list check passed.");

