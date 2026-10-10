import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const { auth } = await import('../server/auth');
  const ctx = await auth.$context;
  const hash = await ctx.password.hash('testpassword');
  console.log('hash:', hash);
  
  try {
    const res1 = await ctx.password.verify({ password: 'testpassword', hash });
    console.log('verify({ password, hash }) #1:', res1);
  } catch (e: unknown) {
    console.log('verify error:', e instanceof Error ? e.message : e);
  }

  try {
    const res3 = await ctx.password.verify({ password: 'testpassword', hash });
    console.log('verify({ password, hash }) #2:', res3);
  } catch (e: unknown) {
    console.log('verify error:', e instanceof Error ? e.stack : e);
  }
}

main();
