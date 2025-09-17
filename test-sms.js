/**
 * 🧪 SCRIPT DE PRUEBA PARA SMS VERIFICATION
 *
 * Este script prueba el endpoint de SMS verificación
 * Ejecutar con: node test-sms.js
 */

const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:8080/api/v1';
const TEST_PHONE = '+542994047906'; // Reemplaza con tu número real

async function testSmsFlow() {
  console.log('🧪 INICIANDO PRUEBA DE SMS VERIFICATION');
  console.log('=====================================');

  try {
    // 1. Enviar SMS
    console.log('\n🔥 PASO 1: Enviando SMS...');
    const sendResponse = await axios.post(`${BASE_URL}/sms/send`, {
      phoneNumber: TEST_PHONE,
      recaptchaToken: `test_recaptcha_token_${Date.now()}`, // Token de prueba
      purpose: 'testing'
    });

    console.log('✅ SMS enviado exitosamente:');
    console.log('📱 Verificación ID:', sendResponse.data.verificationId);
    console.log('⏰ Expira en:', sendResponse.data.expiresAt);
    console.log('🔢 Intentos restantes:', sendResponse.data.attemptsRemaining);

    const verificationId = sendResponse.data.verificationId;

    // 2. Simular espera y solicitar código al usuario
    console.log('\n📱 Revisa tu teléfono para el código SMS...');
    console.log('⚠️  Si no llega el SMS, revisa los logs del backend para obtener el código de testing');

    // Para testing automático, usar código por defecto
    const testCode = '121212'; // Código configurado en .env

    console.log('\n🔐 PASO 2: Verificando código de prueba:', testCode);

    // 3. Verificar código
    const verifyResponse = await axios.post(`${BASE_URL}/sms/verify`, {
      verificationId: verificationId,
      code: testCode
    });

    console.log('✅ Código verificado exitosamente:');
    console.log('✔️  Válido:', verifyResponse.data.isValid);
    console.log('📞 Número:', verifyResponse.data.phoneNumber);
    console.log('💬 Mensaje:', verifyResponse.data.message);

    // 4. Verificar estado
    console.log('\n🔍 PASO 3: Verificando estado del número...');
    const encodedPhone = encodeURIComponent(TEST_PHONE);
    const statusResponse = await axios.get(`${BASE_URL}/sms/status/${encodedPhone}`);

    console.log('📊 Estado del número:');
    console.log('✔️  Verificado:', statusResponse.data.isVerified);
    console.log('📱 Número:', statusResponse.data.phoneNumber);

    console.log('\n🎉 PRUEBA COMPLETADA EXITOSAMENTE! 🎉');

  } catch (error) {
    console.error('\n❌ ERROR EN LA PRUEBA:');
    console.error('Status:', error.response?.status);
    console.error('Mensaje:', error.response?.data?.message || error.message);
    console.error('Detalles:', error.response?.data);

    if (error.response?.status === 500) {
      console.log('\n🔧 POSIBLES SOLUCIONES:');
      console.log('1. Verificar que MongoDB esté ejecutándose');
      console.log('2. Verificar credenciales de Firebase');
      console.log('3. Verificar que el backend esté ejecutándose en puerto 8080');
      console.log('4. Revisar logs del backend para más detalles');
    }
  }
}

// Ejecutar test
testSmsFlow();