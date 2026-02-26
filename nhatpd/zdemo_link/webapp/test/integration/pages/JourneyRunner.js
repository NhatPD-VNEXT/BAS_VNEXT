sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"zdemolink/zdemolink/test/integration/pages/ListList",
	"zdemolink/zdemolink/test/integration/pages/ListObjectPage"
], function (JourneyRunner, ListList, ListObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('zdemolink/zdemolink') + '/test/flp.html#app-preview',
        pages: {
			onTheListList: ListList,
			onTheListObjectPage: ListObjectPage
        },
        async: true
    });

    return runner;
});

