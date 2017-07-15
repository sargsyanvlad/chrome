var client = client || { };

client.connection = { };
client.connection.pbx = { };
client.connection.user = { };
client.connection.service = { };
client.connected = false;
client.isconnection = false;

client.functions = { };
client.handlers = { };
client.calls = { };

client.functions.cleanFormatting = function(number) {
	if (number && number.length>0) {
		return number.replace(/\D+/g,'');
	} else {
		return '';
	}
};

client.functions.add_call = function(call) {
	if (call['uniqueid']) client.calls[call['uniqueid']] = call;
};

client.functions.remove_call = function(call) {
	if (call && client.calls[call]) delete client.calls[call];
};

client.functions.get_call = function(call) {
	if (call && client.calls[call]) return client.calls[call];
};

client.functions.subscribe_events = function(ws) {
	ws.send(JSON.stringify({Action: "Subscribe", "Event": "Newstate", "Channel": client.connection.pbx.sip_channel +'-*'}));
	ws.send(JSON.stringify({Action: "Subscribe", "Event": "Hangup", "Channel": client.connection.pbx.sip_channel +'-*'}));
	ws.send(JSON.stringify({Action: "Subscribe", "Event": "Bridge", "Channel1": client.connection.pbx.sip_channel +'-*'}));
	ws.send(JSON.stringify({Action: "Subscribe", "Event": "Newchannel", "Channel": client.connection.pbx.sip_channel +'-*'}));
};

client.functions.onnewchannel = function(event) {
	var call = { };
	client.functions.getChannelVariable("special", event.Channel).done(function(data) {
		if ( data !== undefined ) {
			if ( data.PARSED !== undefined ) {
				if ( data.PARSED.Value === '' ) {
					call['started'] = new Date();
					call['uniqueid'] = event.Uniqueid;
					call['direction'] = event.Exten === "" ? 'Incoming' : 'Outgoing';
					call['status'] = 'Initializing';
					if (call['direction'] === 'Outgoing') {
						call['callerIdNumber'] = event.Exten;
					}
					call['special'] = false;
					call['bridge'] = false;
					call['channel'] = event.Channel;
					//Thirdlane.extension.devel.log(call);
					client.functions.add_call(call);
					if (client.connected && !client.isconnection && client.handlers.onmessage) client.handlers.onmessage({event:"call_new", data: call});
				} else {
					//Thirdlane.extension.devel.log('1data:  ', data);
					var special_information = data.PARSED.Value.replace("|",",");
					special_information = JSON.parse(special_information.replace(/'/g,'"'));
					call['started'] = new Date();
					call['uniqueid'] = event.Uniqueid;
					call['direction'] = special_information.direction;
					call['status'] = 'Initializing';
					call['callerIdNumber'] = special_information.callerIdNumber;
					call['special'] = true;
					call['bridge'] = false;
					call['channel'] = event.Channel;
					client.functions.add_call(call);
					if (client.connected && !client.isconnection && client.handlers.onmessage) client.handlers.onmessage({event:"call_new", data: call});
				}
			}
		}
	})
};

client.functions.onnewstate = function(event) {
	//Thirdlane.extension.devel.log('onNewState called');
	//Thirdlane.extension.devel.log(event);

	var call = client.functions.get_call(event.Uniqueid);
	//Thirdlane.extension.devel.log(call);
	if (call !== undefined) {
		//if(!call.special) {
			if (event.ChannelStateDesc === "Ring") {
				call.status = 'Dialing';
			} else if (event.ChannelStateDesc === "Ringing") {
				if (event.ConnectedLineNum) call.callerIdNumber = event.ConnectedLineNum;
				if (event.ConnectedLineName) call.callerIdName = event.ConnectedLineName;
				call.status = 'Ringing';
			} else if (event.ChannelStateDesc === "Up") {
				if (event.ConnectedLineNum) call.callerIdNumber = event.ConnectedLineNum;
				if (event.ConnectedLineName) call.callerIdName = event.ConnectedLineName;
				call.status = 'On Call';
			}
		/*} else {
			if (event.ChannelStateDesc === "Up"){
				call.status = 'Dialing';
			}
		}*/

		if (client.connected && !client.isconnection && client.handlers.onmessage) client.handlers.onmessage({event:"call_status", data: call});
	}
};

client.functions.onbridge = function(event) {
	//Thirdlane.extension.devel.log('onBridge Called');
	//Thirdlane.extension.devel.log(event);
	var call = client.functions.get_call(event.Uniqueid1);
	//Thirdlane.extension.devel.log(call);
	if(!call) {
		//Thirdlane.extension.devel.log('trying by unique id 2');
		call = client.functions.get_call(event.Uniqueid2);
		//Thirdlane.extension.devel.log(call);
	}
	if(call){
		if (!call.bridge && event.CallerID2) {
			call.status = 'On Call';
			call.bridge = true;
			call.callerIdNumber = event.CallerID2;
			if (client.connected && !client.isconnection && client.handlers.onmessage) client.handlers.onmessage({event:"call_on", data: call});
		}
	}

};

client.functions.onhangup = function(event) {
	client.functions.remove_call(event.Uniqueid);
	if (client.connected && !client.isconnection && client.handlers.onmessage) client.handlers.onmessage({event:"call_end", data: event.Uniqueid});
};

client.functions.getChannelVariable = function(varName, channel) {
	var data = JSON.stringify({"Action":"GetVar", "Channel":channel, "Variable":varName});
	return $.ajax({
		method: 'POST',
		url: "https://" + client.connection.pbx.address + '/pbx/action',
		cache: false,
		crossDomain: true,
		beforeSend: function(xhr) {
			xhr.setRequestHeader("Websid", Thirdlane.extension.devel.appId);
		},
		xhrFields: {
			withCredentials: true
		},
		data: data
	});
};

client.functions.connect_websockets = function() {
	var ws = new WebSocket("wss://" + client.connection.pbx.address + "/pbx/events/websocket");

	ws.onopen = function() {
		Thirdlane.extension.devel.log("WebSocket Connection is open");
		client.connected = true;
		client.functions.subscribe_events(ws);
		if (client.handlers.onconnect) client.handlers.onconnect();
	};

	ws.onmessage = function (evt) {
		//Thirdlane.extension.devel.log("WebSocket Message received", evt);
		if (evt && evt.data && evt.data === "h") return;

		var event = { Event: evt };
		try {
			event = JSON.parse(evt.data);
		} catch(err) {
			Thirdlane.extension.devel.log("Error while serialization WebSocket message", evt, err);
			return;
		}

		if (event.Event == "Newstate") {
			setTimeout(function() {
				client.functions.onnewstate(event);
			}, 2000);
		} else if (event.Event == "Hangup") {
			client.functions.onhangup(event);
		} else if (event.Event == "Heartbeat") {
			//if (client.connected && !client.isconnection && client.handlers.onmessage) client.handlers.onmessage({event:"heartbeat", event: event});
		} else if (event.Event === 'Newchannel') {
			client.functions.onnewchannel(event);
		} else {
			if (event.Event === "Bridge") {
				client.functions.onbridge(event);
			}
		}

	};

	ws.onclose = function() {
		Thirdlane.extension.devel.log("Websocket Connection is closed");
		client.connected = false;
		if (!client.isconnection && client.handlers.ondisconnect) client.handlers.ondisconnect();
	};

	ws.onerror = function() {
		Thirdlane.extension.devel.log("Websocket Connection error");
		client.connected = false;
		if (!client.isconnection && client.handlers.ondisconnect) client.handlers.ondisconnect();
	};

	client.connection.socket = ws;
};

client.functions.get_pbx_config = function() {
	$.ajax({
		type: "GET",
		url: "https://" + client.connection.pbx.address + "/api/settings",
		dataType: "json",
		cache: false,
		crossDomain: true,
		error: function (e) {
			if (client.handlers.onerror) client.handlers.onerror({error: "msg_connection_error"});
		},
		success: function (e, status, data) {
			Thirdlane.extension.devel.log('PBX Settings response', data);
			if (data.responseJSON) {
				//if (client.handlers.onlogin) client.handlers.onlogin();
				if (client.handlers.onlogin) client.handlers.onlogin(data.responseJSON);
			} else {
				Thirdlane.extension.devel.log('PBX Settings error');
				if (client.handlers.onerror) client.handlers.onerror({error: "msg_connection_error"});
			}
		},
		async: true,

		beforeSend: function(xhr) {
			xhr.setRequestHeader("Websid", Thirdlane.extension.devel.appId);
		},
		xhrFields: {
				withCredentials: true
		}
	});
}

client.functions.set_pbx_config = function(configuration) {
	if(!configuration) return false;
	$.ajax({
		type: "PUT",
		url: "https://" + client.connection.pbx.address + "/api/settings",
		//dataType: "json",
		cache: false,
		crossDomain: true,
		error: function (e) {
			//if (client.handlers.onerror) client.handlers.onerror({error: "msg_connection_error"});
		},
		success: function (e, status, data) {
			Thirdlane.extension.devel.log('Save PBX Settings response', data);
		},
		async: true,

		beforeSend: function(xhr) {
			xhr.setRequestHeader("Websid", Thirdlane.extension.devel.appId);
		},
		xhrFields: {
				withCredentials: true
		},
		data: JSON.stringify(configuration)
	});
}

client.functions.connection_test = function() {
	$.ajax({
		type: "GET",
		url: "https://" + client.connection.pbx.address + "/asterisk/module.info",
		//dataType: "json",
		cache: false,
		crossDomain: true,
		error: function (e) {
			client.isconnection = false;
			if (client.handlers.onerror) client.handlers.onerror({error: "msg_connection_error"});
		},
		success: function (e, status, data) {
			Thirdlane.extension.devel.log('Connection test response', data);
			if (data.responseText && data.responseText.indexOf("version") != -1) {
				Thirdlane.extension.devel.log('Login ok');
				client.functions.get_pbx_config();
				client.functions.connect_websockets();
			} else {
				Thirdlane.extension.devel.log('Login error');
				if (client.handlers.onerror) client.handlers.onerror({error: "msg_login_error"});
			}
			client.isconnection = false;
		},
		async: true,

		beforeSend: function(xhr) {
			xhr.setRequestHeader("Websid", Thirdlane.extension.devel.appId);
		},
		xhrFields: {
				withCredentials: true
		}
	});
}

client.functions.process_connection = function() {
	chrome.cookies.getAll({"url": "https://" + client.connection.pbx.address + "/" + Thirdlane.extension.devel.appId, "name": "websid"}, function(new_cookies){
		Thirdlane.extension.devel.log('New cookies', new_cookies);

		if (new_cookies && new_cookies.length) {
			var found_cookie = false;

			$.each(new_cookies, function(idx_cookie, new_cookie) {
				Thirdlane.extension.devel.log('New cookie', new_cookie);
				Thirdlane.extension.devel.log('New cookie value', new_cookie.value);

				if(new_cookie.path && new_cookie.path === "/" + Thirdlane.extension.devel.appId && new_cookie.name && new_cookie.name === "websid") {
					found_cookie = true;
					// remove old cookie
					chrome.cookies.remove({"url": "https://" + client.connection.pbx.address + "/", "name": Thirdlane.extension.devel.appId + "_websid"}, function(old_cookie){
						// set new cookie
						chrome.cookies.set(
							{
								"url":"https://" + client.connection.pbx.address + "/",
								"path":"/",
								"secure":true,
								"name": Thirdlane.extension.devel.appId + "_websid",
								"value": new_cookie.value.toString()
							},
							function(created_cookie) {
								Thirdlane.extension.devel.log('Created cookie', created_cookie);

								chrome.cookies.remove({"url": "https://" + client.connection.pbx.address + "/" + Thirdlane.extension.devel.appId, "name": "websid"}, function(removed_cookie){
									Thirdlane.extension.devel.log('Removed new cookie', removed_cookie);
								});

								client.functions.connection_test();
							});
					});
				}
			});

			if (!found_cookie) {
				$.each(new_cookies, function(idx_cookie, new_cookie) {
					Thirdlane.extension.devel.log('New cookie', new_cookie);
					Thirdlane.extension.devel.log('New cookie value', new_cookie.value);

					if(new_cookie.name && new_cookie.name === "websid" && new_cookie.value && new_cookie.value.length && new_cookie.value != "x") {
						found_cookie = true;
						client.functions.connection_test();
					}
					if(new_cookie.name && new_cookie.name.indexOf("_websid") != -1 && new_cookie.value && new_cookie.value.length && new_cookie.value != "x") {
						found_cookie = true;
						client.functions.connection_test();
					}
				});
			}

			if (!found_cookie) {
				client.connected = false;
				if (client.handlers.onerror) client.handlers.onerror({error:'msg_login_error'});
			}
		} else {
			// no cookie
			client.connected = false;
			if (client.handlers.onerror) client.handlers.onerror({error:'msg_login_error'});
		}
	});
};

client.functions.make_call = function (number, callerid) {

	var packet = {
		"Action": "Originate",
		"Channel": client.connection.pbx.channel,
		"Context": client.connection.pbx.context,
		"Exten": clearNumber(number.toString()),
		"Priority": "1",
		"CallerID": number.toString(),
		"Variable": [
			"special={'callerIdNumber':'" + clearNumber(number.toString()) + "'|'direction':'Outgoing'}",
			"ORIGINATING_USER=" + client.connection.user.extension,
			"ORIGINATE_SRC=" + client.connection.user.extension,
			"ORIGINATE_DST=" + clearNumber(number.toString()),
			"tenant=" + client.connection.user.tenant,
			"TL_DASH=" + client.connection.user.tl_dash
		]
	};

	if (callerid) {
		packet["CallerID"] = callerid;
	}

	$.ajax({
		method: 'POST',
		url: "https://" + client.connection.pbx.address + '/pbx/action',
		cache: false,
		crossDomain: true,
		beforeSend: function(xhr) {
			xhr.setRequestHeader("Websid", Thirdlane.extension.devel.appId);
		},
		xhrFields: {
				withCredentials: true
		},
		data: JSON.stringify(packet)
	});

};

client.functions.process_handlers = function (config) {
	if (config.handlers) {
		if(config.handlers.onlogin) client.handlers.onlogin = config.handlers.onlogin;
		if(config.handlers.onconnect) client.handlers.onconnect = config.handlers.onconnect;
		if(config.handlers.ondisconnect) client.handlers.ondisconnect = config.handlers.ondisconnect;
		if(config.handlers.onerror) client.handlers.onerror = config.handlers.onerror;
		if(config.handlers.onmessage) client.handlers.onmessage = config.handlers.onmessage;
	}
};

client.functions.process_config = function (config) {
	var tenant = "";
	var extension = "";

	client.connection.user.login = config.username;
	client.connection.user.password = config.password;
	client.connection.pbx.address = config.address;
	client.connection.pbx.host = client.connection.pbx.address.split(':')[0];
	//client.connection.pbx.context = 'from-inside';

	var ext_regex = /^(.*?)\-(.*?)$/;
	var ext_array = ext_regex.exec(client.connection.user.login);
	if ( ext_array != null ) {
		tenant = ext_array[1];
		extension = ext_array[2];

		client.connection.user.tl_dash = "-";
		client.connection.user.tenant = tenant;
		client.connection.user.extension = extension;
		client.connection.pbx.context = "from-inside-" + tenant;
		client.connection.pbx.channel = "Local/" + extension + "@tl-originate/n";
		client.connection.pbx.sip_channel = "SIP/" + extension + "-" + tenant;

		if ( !client.connection.user.channel ) {
			client.connection.user.channel = "SIP/" + extension + "-" + tenant;
		}
	} else {
		extension = client.connection.user.login;

		client.connection.user.tl_dash = "";
		client.connection.user.tenant = "";
		client.connection.user.extension = extension;
		client.connection.pbx.context = "from-inside";
		client.connection.pbx.channel = "Local/" + extension + "@tl-originate/n";
		client.connection.pbx.sip_channel = "SIP/" + extension;

		if ( !client.connection.user.channel ) {
			client.connection.user.channel = "SIP/" + extension;
		}
	}

	client.functions.process_handlers(config);
};

client.functions.disconnect = function () {
	client.connected = false;
	if (client.connection.socket) {
		try {
			client.connection.socket.close();
		} catch(err) { }
	}
	client.connection.socket = null;
};

client.functions.connect = function (config) {
	client.isconnection = true;
	client.functions.disconnect();

	client.functions.process_config(config);

	chrome.cookies.remove({"url": "https://" + client.connection.pbx.address + "/", "name": Thirdlane.extension.devel.appId + "_websid"}, function(old_cookie) { } );
	chrome.cookies.remove({"url": "https://" + client.connection.pbx.address + "/", "name": "55websid"}, function(old_cookie) { } );

	$.ajax({
		type: "GET",
		url: "https://" + client.connection.pbx.address + "/session_login.cgi",
		cache: false,
		crossDomain: true,
		error: function (e) {
			client.isconnection = false;
			if (client.handlers.onerror) client.handlers.onerror({error: "msg_connection_error"});
		},
		success: function (e, status, xhr) {
			Thirdlane.extension.devel.log('Login response', xhr);
			client.functions.process_connection();
		},
		async: true,
		data: {
			"user": client.connection.user.login,
			"pass": client.connection.user.password,
			"page": "/asterisk/module.info"
		},
		beforeSend: function(xhr) {
			xhr.setRequestHeader("Websid", Thirdlane.extension.devel.appId);
		},
		xhrFields: {
				withCredentials: true
		}
	});

	return client;
};

client.connect = function (config) {
	return client.functions.connect(config);
};

client.disconnect = function (config) {
	return client.functions.disconnect();
};

client.make_call = function (number, callerid) {
	return client.functions.make_call(number, callerid);
};
