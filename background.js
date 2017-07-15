var Thirdlane = Thirdlane || { };

Thirdlane.extension = Thirdlane.extension || { };

Thirdlane.extension.functions = Thirdlane.extension.functions || { };

Thirdlane.extension.handlers = Thirdlane.extension.handlers || { };

Thirdlane.extension.state = Thirdlane.extension.state || { };



Thirdlane.extension.telephony = Thirdlane.extension.telephony || { };
Thirdlane.extension.telephony.handlers = Thirdlane.extension.telephony.handlers || { };
Thirdlane.extension.telephony.functions = Thirdlane.extension.telephony.functions || { };
Thirdlane.extension.telephony.calls = { };
Thirdlane.extension.telephony.connected = false;
Thirdlane.extension.telephony.pbx_configuration = { };

Thirdlane.extension.devel = {
    appId: 'tlconnectex',
    name: chrome.runtime.getManifest().name,
    version: chrome.runtime.getManifest().version,
    build: 'beta',
    copyright: 'Thirdlane',

    debug: false,

    log: function() {
        try {
            if ( Thirdlane.extension.devel.debug || Thirdlane.extension.devel.build === 'alpha' ) {
                var args = Array.prototype.slice.call(arguments, 0);
                args.unshift('[' + Thirdlane.extension.devel.name + ' ' + Thirdlane.extension.devel.version + ' ' + Thirdlane.extension.devel.build + ']', _datetime(), ':');
                console.log.apply(console, args);
            }
        } catch(err) { }
    }
};

//end


Thirdlane.extension.functions.makeTelephonyCall = function (number, callerid) {
    return client.make_call(clearNumber(number), callerid);
};

Thirdlane.extension.telephony.handlers.onlogin = function(config) {
    var msg ="";
};
Thirdlane.extension.telephony.handlers.onconnect = function() {
    var msg ="";
};


Thirdlane.extension.telephony.handlers.ondisconnect = function() {
    var msg ="";
};

Thirdlane.extension.telephony.handlers.onerror = function(msg) {
    var msg ="";
};

Thirdlane.extension.telephony.handlers.onmessage = function(msg) {
    var msg ="";
};

//---------------------------------------------------------------------

Thirdlane.extension.telephony.functions.client_connect = function () {
    // Thirdlane.extension.functions.setInfo('lastError', 'msg_initialization');
    // Thirdlane.extension.functions.setInfo('configError', '');
    var configuration = Thirdlane.extension.functions.getConfig();
    chrome.extension.getBackgroundPage().console.log('getconfiglog');
    if(configuration.address || configuration.address === '') {
        chrome.extension.getBackgroundPage().console.log('config address log');
        configuration.handlers = {
            onlogin: Thirdlane.extension.telephony.handlers.onlogin,
            onconnect: Thirdlane.extension.telephony.handlers.onconnect,
            ondisconnect: Thirdlane.extension.telephony.handlers.ondisconnect,
            onerror: Thirdlane.extension.telephony.handlers.onerror,
            onmessage: Thirdlane.extension.telephony.handlers.onmessage
        };

        return Thirdlane.extension.telephony.client = client.connect(configuration);
    }
};
//-------------------------guess configured---------------------------

Thirdlane.extension.functions.guessConfigured = function (callback) {
    Thirdlane.extension.telephony.connected = false;
    var configuration = Thirdlane.extension.functions.getConfig();
    if ((configuration.address === 'your_pbx_address:10000' || configuration.address === '') && configuration.username === '' && configuration.password === '') {
        var sync_prefs = new SyncPreferences();
        sync_prefs.get('config', function(config) {
            Thirdlane.extension.devel.log('Received sync_prefs', config);
            if (config && config.config && config.config.address && config.config.address != '' && config.config.address != 'your_pbx_address:10000') {
                Thirdlane.extension.devel.log('Maybe good config...');
                Thirdlane.extension.functions.setConfig(config.config);
            }
            if (callback) callback(config.config);
        });
    } else {
        if (callback) callback({});
    }
};

//-------------------------getConfig getinfo, setinfo-----------------------------------//
Thirdlane.extension.functions.getConfig = function (key) {
    var configuration = { };
    if (key) {
        configuration[key] = Preferences.get(key);
    } else {
        $.each(window.localStorage, function( key, val ) { configuration[key] = Preferences.get(key); });
    }

    return configuration;
};

Thirdlane.extension.functions.setConfig = function (config) {
    $.each( config, function( key, val ) {
        Preferences.set(key, val);
    });

    return Thirdlane.extension.functions.getConfig();
};

Thirdlane.extension.functions.getInfo = function (type) {
    var configuration = Preferences.get('information');

    return configuration[type];
};

Thirdlane.extension.functions.setInfo = function (type, value) {
    var configuration = Preferences.get('information');

    configuration[type] = value;

    Preferences.set('information', configuration);

    return configuration[type];
};

Thirdlane.extension.functions.clearInfo = function () {
    var configuration = { lastError: '' };

    Preferences.set('information', configuration);
};

function clearNumber(number) {
    if (number && number.length>0) {
        return (number.indexOf('+') != -1 ? "+" : "") + number.replace(/\D+/g,'');
    } else {
        return '';
    }
};

// Thirdlane.extension.functions.client_disconnect = function () {};
//----------------------------------------------------------------------------------
Thirdlane.extension.telephony.functions.client_disconnect = function () {
    Thirdlane.extension.telephony.connected = false;
    if(Thirdlane.extension.telephony.client) Thirdlane.extension.telephony.client.disconnect();
};

//---------------------------------------------------------------------------------


//call setconfig connect
    chrome.runtime.onConnect.addListener(function(port) {
        port.onMessage.addListener(function(msg) {
            if(msg.action === 'call'){
                Thirdlane.extension.functions.makeTelephonyCall(msg.number, msg.callerid)
            }
            else if(msg.action === 'setConfig' ){
                Thirdlane.extension.functions.setConfig(msg.configuration);
            }
            else
            if(msg.action === 'connect'){
                Thirdlane.extension.telephony.functions.client_connect();
            }
            else
            if (msg.action ==='disconnect'){
                Thirdlane.extension.telephony.functions.client_disconnect();
            }
            else if (msg.action && msg.action === 'get_configuration') {
                var configuration = Thirdlane.extension.functions.getConfig();
                configuration['pbx'] = Thirdlane.extension.telephony.pbx_configuration;
                port.postMessage({config: configuration});
                Thirdlane.extension.devel.log('sending config', configuration);
            }
            else if (msg.action && msg.action === 'get_telephony_status') {
                port.postMessage({telephony_connected: Thirdlane.extension.telephony.connected});
                Thirdlane.extension.devel.log('sending config', Thirdlane.extension.telephony.connected);
            }
            else if (msg.action === 'set_configuration') {
                if(msg.config.address) {
                    msg.config.address = msg.config.address.trim();
                    if (msg.config.address.length === 0) msg.config.address = 'your_pbx_address';
                    if (msg.config.address.indexOf('http') === 0) msg.config.address = msg.config.address.split('/')[2];
                    if (msg.config.address.indexOf(':') === -1) msg.config.address += ':10000';
                } else {
                    msg.config.address = 'your_pbx_address:10000';
                }

                var configuration = Thirdlane.extension.functions.setConfig(msg.config);
                Thirdlane.extension.devel.log('saved config', configuration);

                port.postMessage({action: 'connect', config: configuration});
                // Thirdlane.extension.FSM.reconfigure();
            }


        });


});
chrome.extension.getBackgroundPage().console.log('TEST LOGGGG');

Thirdlane.extension.functions.guessConfigured(function(config) {

});
Thirdlane.extension.telephony.functions.client_connect();


