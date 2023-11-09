sap.ui.define([
		"egston/qm/ma/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("egston.qm.ma.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);