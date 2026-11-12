import 'dotenv/config';
import readline from 'node:readline';
import mongoose from 'mongoose';
import connectDatabase from '../config/database.js';
import {
  bootstrapFirstAdmin,
  checkAdminExists,
  DEFAULT_ADMIN_NAME,
} from './admin-bootstrap.core.js';

function promptLine(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptHiddenLine(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      reject(new Error('Interactive password prompt requires a TTY terminal.'));
      return;
    }

    stdout.write(question);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    let buffer = '';

    const cleanup = () => {
      stdin.removeListener('data', onData);
      if (typeof stdin.setRawMode === 'function') {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdout.write('\n');
          cleanup();
          resolve(buffer);
          return;
        }
        if (ch === '\u0003') {
          stdout.write('\n');
          cleanup();
          reject(new Error('Operation cancelled by operator.'));
          return;
        }
        if (ch === '\u007f' || ch === '\b') {
          if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        if (ch >= ' ') {
          buffer += ch;
          stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function resolveOperatorInput(): Promise<{
  name?: string;
  email: string;
  password: string;
}> {
  const envName = process.env.ADMIN_NAME?.trim();
  const envEmail = process.env.ADMIN_EMAIL?.trim();
  const envPassword = process.env.ADMIN_PASSWORD;

  if (envEmail && envPassword) {
    return {
      name: envName || DEFAULT_ADMIN_NAME,
      email: envEmail,
      password: envPassword,
    };
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      'Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables in non-interactive mode.'
    );
  }

  const nameAnswer =
    envName ||
    (await promptLine(`Admin full name [${DEFAULT_ADMIN_NAME}]: `)).trim() ||
    DEFAULT_ADMIN_NAME;

  const emailAnswer =
    envEmail || (await promptLine('Admin email address: ')).trim();

  const passwordAnswer = envPassword ?? (await promptHiddenLine('Admin password (min 8 chars): '));
  if (!envPassword) {
    const confirmAnswer = await promptHiddenLine('Confirm admin password: ');
    if (passwordAnswer !== confirmAnswer) {
      throw new Error('Passwords did not match.');
    }
  }

  return {
    name: nameAnswer,
    email: emailAnswer,
    password: passwordAnswer,
  };
}

async function runCli(): Promise<number> {
  await connectDatabase();

  // Fail fast before collecting credentials if an Admin already exists
  if (await checkAdminExists()) {
    console.error(
      '[bootstrap:admin] Refused: An Admin account already exists. Creating additional Admin accounts via bootstrap is disabled.'
    );
    return 1;
  }

  const input = await resolveOperatorInput();
  const result = await bootstrapFirstAdmin(input);

  if (!result.ok) {
    console.error(`[bootstrap:admin] ${result.message}`);
    if (result.errors && result.errors.length > 0) {
      for (const issue of result.errors) {
        console.error(`  - ${issue.field}: ${issue.message}`);
      }
    }
    return 1;
  }

  console.log(
    `[bootstrap:admin] ${result.message} Account ready — id: ${result.user._id}, email: ${result.user.email}, role: ${result.user.role}`
  );
  return 0;
}

runCli()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unexpected bootstrap failure.';
    console.error(`[bootstrap:admin] Error: ${message}`);
    return 1;
  })
  .then(async (exitCode) => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('[db] MongoDB connection closed.');
      }
    } catch {
      console.error('[db] Warning: Failed to close MongoDB connection cleanly.');
    } finally {
      process.exit(exitCode);
    }
  });
