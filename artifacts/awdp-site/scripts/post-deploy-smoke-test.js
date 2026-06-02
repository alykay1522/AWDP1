const BASE_URL = process.env.SITE_URL || 'https://allwindowdoorparts.com';

const results = [];

function log(message, success = true) {
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${message}`);
  results.push({ message, success });
}

async function checkHomepage() {
  try {
    const res = await fetch(BASE_URL);
    if (res.ok) {
      log('Homepage loads successfully');
    } else {
      log(`Homepage returned status ${res.status}`, false);
    }
  } catch (err) {
    log(`Homepage failed to load: ${err.message}`, false);
  }
}

async function testContactForm() {
  try {
    const res = await fetch(`${BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test',
        email: 'smoketest@example.com',
        message: 'Automated post-deploy smoke test',
        subject: 'Smoke Test',
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      log('Contact form submission successful');
    } else {
      log(`Contact form failed: ${data.error || res.statusText}`, false);
    }
  } catch (err) {
    log(`Contact form error: ${err.message}`, false);
  }
}

async function testPartsIdForm() {
  try {
    const res = await fetch(`${BASE_URL}/api/parts-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Smoke Test',
        email: 'smoketest@example.com',
        description: 'Automated smoke test for parts identification',
        windowDoorBrand: 'Test Brand',
        windowDoorAge: '5-10 years',
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      log('Parts ID form submission successful');
    } else {
      log(`Parts ID form failed: ${data.error || res.statusText}`, false);
    }
  } catch (err) {
    log(`Parts ID form error: ${err.message}`, false);
  }
}

async function runSmokeTests() {
  console.log(`\n🚀 Running post-deploy smoke tests on: ${BASE_URL}\n`);

  await checkHomepage();
  await testContactForm();
  await testPartsIdForm();

  console.log('\n--- Summary ---');
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nSome tests failed. Please investigate.');
    process.exit(1);
  } else {
    console.log('\nAll smoke tests passed! Site looks healthy.');
  }
}

runSmokeTests();
