$(function() {
    var telephony_port = chrome.runtime.connect({name: "telephony"});
    telephony_port.onMessage.addListener(function(msg) { });

//sync settings-----------------------------------------------------------------

    var config_port = chrome.runtime.connect({name: "configuration"});

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
    config_port.postMessage({action: "get_information", type: "configError"});

    $("#save").click(function(){
        send_config($('#address').val(),  $('#username').val(), $('#password').val());
        start_connect();
        window.close();
    });

    function send_config( address_param, username_param, password_param) {
        var configuration = {
            action:'setConfig',
            configuration:{address: address_param, username: username_param, password: password_param}
        };
        telephony_port.postMessage( configuration);
    }

    $("#logout").click(function(){
        window.localStorage.clear();
        location.reload();
        disconnect();
    });

    function disconnect( ) {
        var configuration = {
            action:'disconnect'
        };
        telephony_port.postMessage( configuration);
    }

    function start_connect() {
        telephony_port.postMessage({action: 'connect'});
    }

});