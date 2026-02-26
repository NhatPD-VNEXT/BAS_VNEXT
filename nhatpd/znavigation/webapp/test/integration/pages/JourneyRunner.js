sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"znavigation/test/integration/pages/NAVIGATIONList",
	"znavigation/test/integration/pages/NAVIGATIONObjectPage"
], function (JourneyRunner, NAVIGATIONList, NAVIGATIONObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('znavigation') + '/test/flp.html#app-preview',
        pages: {
			onTheNAVIGATIONList: NAVIGATIONList,
			onTheNAVIGATIONObjectPage: NAVIGATIONObjectPage
        },
        async: true
    });

    return runner;
});

