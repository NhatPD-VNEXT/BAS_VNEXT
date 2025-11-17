sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"zdemonavigation/test/integration/pages/FI_DOCList",
	"zdemonavigation/test/integration/pages/FI_DOCObjectPage"
], function (JourneyRunner, FI_DOCList, FI_DOCObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('zdemonavigation') + '/test/flp.html#app-preview',
        pages: {
			onTheFI_DOCList: FI_DOCList,
			onTheFI_DOCObjectPage: FI_DOCObjectPage
        },
        async: true
    });

    return runner;
});

