// var Preferences = {
//     defaults: {
//         enabled: true,
//         address: 'your_pbx_address:10000',
//         username: '',
//         password: '',
//         notifications: true,
//         popups: true
//     },
//     set: function(name, value) { window.localStorage[name] = JSON.stringify(value); },
//     get: function(name) {
//         var value = window.localStorage[name];
//         if (value == null || value == undefined) { value = this.defaults[name]; }
//         else { value = JSON.parse(value); }
//         return value;
//     }
// };
//
// function SyncPreferences(settings) {
//     var defaults = {
//         enabled: true,
//         address: 'your_pbx_address:10000',
//         username: '',
//         password: '',
//         notifications: true,
//         popups: true
//     };
//
//     this.data = $.extend(defaults, settings);
// }
//
// SyncPreferences.prototype = {
//     set: function(config, cb) {
//         chrome.storage.sync.set(config, cb);
//     },
//     get: function(keys, cb) {
//         chrome.storage.sync.get(keys, cb);
//     },
//     remove: function(keys, cb) {
//         chrome.storage.sync.remove(keys, cb);
//     },
//     clear: function(cb) {
//         chrome.storage.sync.clear(keys, cb);
//     }
// };


$(function() {
    var telephony_port = chrome.runtime.connect({name: "telephony"});
    telephony_port.onMessage.addListener(function(msg) { });

    var telephony_port = chrome.runtime.connect({name: "configuration"});

    telephony_port.onMessage.addListener(function(msg) {
        if (msg && msg.config) {
            $('#address').val(msg.config.address);
            $('#username').val(msg.config.username);
            $('#password').val(msg.config.password);
        }
        else if (msg && msg.telephony_connected) {
            $(".external-config").show();
        }
    });

    telephony_port.postMessage({action: "get_telephony_status"});
    telephony_port.postMessage({action: "get_configuration"});

    $(".dialpad-button").click(function() {
        var numberInput = $('#phone_number_input'), digit = $(this).attr('data-value');
        var current = numberInput.val();
        numberInput.val(current + digit);
    });

    $('#save').click(function(){
        var configuration = {
            address: $('#address').val(),
            username: $('#username').val(),
            password: $('#password').val(),
        };

        telephony_port.postMessage({action: "set_configuration", config: configuration});
        window.close();
    });

    $("#logout").click(function(){
        window.localStorage.clear();
        location.reload();
        var configuration = {
            address: $('#address').val(""),
            username: $('#username').val(""),
            password: $('#password').val(""),
        };
        telephony_port.postMessage({action: "disconnect", config: configuration});

    });

    $("#make-call").click(function(){
        make_call($("#phone_number_input").val());

        var btn = $(this);
        btn.text('Calling...');
        btn.prop('disabled', true);
        setTimeout(function() {
            btn.text('Call');
            btn.prop('disabled', false);
        }, 3000)
    });

    function make_call(phone_number) {
        var msg = {
            action: 'call',
            number: phone_number,
            callerid: phone_number
            // callerid:{ phone_number_input: phone_number},
        };
        telephony_port.postMessage(msg);
    }
    function start_connection() {
        telephony_port.postMessage({action:"connect"})
    }

    $("#make-connection").click (function(){
        start_connection();
    });

});

// //$(function() {
//     var telephony_port = chrome.runtime.connect({name: "telephony"});
//     telephony_port.onMessage.addListener(function(msg) { });
//
// //sync settings-----------------------------------------------------------------
//
//     var config_port = chrome.runtime.connect({name: "configuration"});
//
//     config_port.onMessage.addListener(function(msg) {
//         if (msg && msg.config) {
//             $('#address').val(msg.config.address);
//             $('#username').val(msg.config.username);
//             $('#password').val(msg.config.password);
//         }
//         else if (msg && msg.telephony_connected) {
//             $(".external-config").show();
//         }
//     });
//
//     config_port.postMessage({action: "get_telephony_status"});
//     config_port.postMessage({action: "get_configuration"});
// //-----------------------------------------------------------------
// Save config
//
//     $('#save').click(function(){
//         var configuration = {
//             address: $('#address').val(),
//             username: $('#username').val(),
//             password: $('#password').val(),
//
//             pbx : {
//                 additional_phone_lookup_url: $('#lookupurl').val()
//             },
//
//             notifications: $('#notifications').is(':checked'),
//             popups: $('#popups').is(':checked')
//         };
//
//         config_port.postMessage({action: "set_configuration", config: configuration});
//         start_connect();
//         window.close();
//     });
//config

    // function send_config( address_param, username_param, password_param) {
    //     var configuration = {
    //         action:'setConfig',
    //         configuration:{address: address_param, username: username_param, password: password_param}
    //     };
    //     telephony_port.postMessage( configuration);
    // }
    //
    // function start_connect() {
    //     telephony_port.postMessage({action:'connect' });
    //     // config_port.postMessage({action: "set_configuration", config: configuration});
    // }

    // $("#make-connection").bind('click',function(){
//     client_connect();
    // });

