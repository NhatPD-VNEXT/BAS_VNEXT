sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"zsbu4demopage/test/integration/pages/deliveryMain"
], function (JourneyRunner, deliveryMain) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('zsbu4demopage') + '/test/flp.html#app-preview',
        pages: {
			onThedeliveryMain: deliveryMain
        },
        async: true
    });

    return runner;
});

