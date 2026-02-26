/*global QUnit*/

sap.ui.define([
	"zsbu4rapse16n/controller/SE16N.controller"
], function (Controller) {
	"use strict";

	QUnit.module("SE16N Controller");

	QUnit.test("I should test the SE16N controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
