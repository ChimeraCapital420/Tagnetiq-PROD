// scripts/run-cerberus-test.ts
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

// We'll need to adjust this import path
async function executeCerberusTest() {
  console.log('🚀 CERBERUS TEST PROTOCOL INITIATED\n');
  
  // Read the saved credentials
  let credentials;
  try {
    const credFile = fs.readFileSync('cerberus-credentials.json', 'utf8');
    credentials = JSON.parse(credFile);
    console.log('✅ Loaded credentials for:', credentials.email);
  } catch (error) {
    console.error('❌ No credentials found. Run provision-test-agent.ts first!');
    return;
  }

  // Import and run the test
  const { runBasicTest } = await import('../api/cerberus/test-basic-flow');
  
  try {
    const results = await runBasicTest(credentials);
    
    console.log('\n📈 TEST RESULTS:');
    console.log('Success:', results.success);
    
    // Save results
    fs.writeFileSync(
      `cerberus-test-results-${Date.now()}.json`,
      JSON.stringify(results, null, 2)
    );
    
    console.log('\nResults saved to file!');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
  }
}

executeCerberusTest();