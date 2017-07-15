var Preferences = {
    defaults: {
        enabled: true,
        address: 'your_pbx_address:10000',
        username: '',
        password: '',
        notifications: true,
        popups: true
    },
    set: function(name, value) { window.localStorage[name] = JSON.stringify(value); },
    get: function(name) {
        var value = window.localStorage[name];
        if (value == null || value == undefined) { value = this.defaults[name]; }
        else { value = JSON.parse(value); }
        return value;
    }
};

function SyncPreferences(settings) {
    var defaults = {
        enabled: true,
        address: 'your_pbx_address:10000',
        username: '',
        password: '',
        notifications: true,
        popups: true
    };

    this.data = $.extend(defaults, settings);
}

SyncPreferences.prototype = {
    set: function(config, cb) {
        chrome.storage.sync.set(config, cb);
    },
    get: function(keys, cb) {
        chrome.storage.sync.get(keys, cb);
    },
    remove: function(keys, cb) {
        chrome.storage.sync.remove(keys, cb);
    },
    clear: function(cb) {
        chrome.storage.sync.clear(keys, cb);
    }
};

