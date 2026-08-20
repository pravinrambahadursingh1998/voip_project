const getEsl = require('../config/esl');

/**
 * Tell FreeSWITCH to reload XML (xml_curl) and rescan sofia gateways.
 * Gateways live in DB and are served by fsController — no file write needed.
 */
function refreshFreeSWITCH() {
  return new Promise((resolve) => {
    const conn = getEsl();

    if (!conn) {
      console.log('❌ ESL not connected — FreeSWITCH not refreshed');
      return resolve({ success: false, message: 'ESL not connected' });
    }

    console.log('🔄 Reloading FreeSWITCH XML + rescanning sofia profile...');

    conn.api('reloadxml', () => {
      conn.api('sofia profile external rescan', (res) => {
        const body = res && typeof res.getBody === 'function' ? res.getBody() : '';
        console.log('✅ FreeSWITCH refreshed:', body || 'ok');
        resolve({ success: true, body });
      });
    });
  });
}

exports.refreshFreeSWITCH = refreshFreeSWITCH;

exports.createGateway = async () => {
  return refreshFreeSWITCH();
};

exports.deleteGateway = async () => {
  return refreshFreeSWITCH();
};

exports.getGatewayStatus = (name) => {
  return new Promise((resolve) => {
    const conn = getEsl();
    if (!conn) {
      return resolve('ESL not connected');
    }
    conn.api(`sofia status gateway ${name}`, (r) => {
      resolve(r.getBody());
    });
  });
};
