sap.ui.define([
	"egston/qm/ma/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"egston/qm/ma/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(BaseController, JSONModel, History, formatter, Filter, FilterOperator) {
	"use strict";
	return BaseController.extend("egston.qm.ma.controller.Worklist", {
		formatter: formatter,
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		onInit: function() {
			this.oFilter = this.byId("filter");
			this.oTable = this.byId("table");
			this.oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				saveAsTileTitle: this.getResourceBundle().getText("saveAsTileTitle", this.getResourceBundle().getText("worklistViewTitle")),
				shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
				shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
				shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				tableBusyDelay: 0,
				notifications: [],
				showDetails: false,
				showTable: false,
				showBarcode: true
			});
			this.setModel(this.oViewModel, "worklistView"); // Make sure, busy indication is showing immediately so there is no
		},
		onAfterRendering: function() {
			/*		setTimeout(function() {
						//do something once
						try {
							var oBarcode = window.parent.cordova.plugins.barcodeScanner;
							if (oBarcode !== undefined) {
								this.oViewModel.setProperty("/showBarcode", true);
							}
						} catch (err) {
							this.oViewModel.setProperty("/showBarcode", false);
						}
					}.bind(this), 1000);*/
			this.initDefaults();
			$("#pic-uploader").hide();
			// Uploading
			//	var that = this;
			$("#pic-uploader").change(function(e) {
				//	var aItems = that.oUploadModel.getProperty("/items");
				var oFile = e.currentTarget.files[0];
				/*	if (oFile.size > 10000000) {
						sap.m.MessageBox.show(that.sMessageError, {
							icon: sap.m.MessageBox.Icon.ERROR,
							title: oBundle.getText('notif_upl_size'),
						});
						return;
					}*/
				this._readFile(oFile).done(function(oRaw) {
					var oNotif = this.oViewModel.getProperty(this._sNotifUploadPath);
					oFile.raw = oRaw;
					oNotif.oPhoto = oFile;
					oNotif._showUpload = false;
					oNotif._showDelete = true;
					this.oViewModel.setProperty(this._sNotifUploadPath, oNotif);
					$("#pic-uploader").val("");
				}.bind(this));
			}.bind(this));
		},
		_readFile: function(file) {
			var reader = new FileReader();
			var deferred = $.Deferred();
			reader.onload = function(event) {
				deferred.resolve(event.target.result);
			};
			reader.onerror = function() {
				deferred.reject(this);
			};
			if (/^image/.test(file.type)) {
				reader.readAsDataURL(file);
			} else {
				reader.readAsText(file);
			}
			return deferred.promise();
		},
		onScanPress: function() {
			try {
				window.parent.cordova.plugins.barcodeScanner.scan(function(result) {
					if (result.cancelled) {
						return;
					}
					this.getView().byId("Aufnr").setValue("");
					this.getView().byId("Vornr").setValue("");
					var aInput = result.text.split("/");
					if (aInput.length !== 2) {
						sap.m.MessageBox.information(this.getResourceBundle().getText("messageBarcodeError"), {
							styleClass: "sapUiSizeCompact"
						});
						return;
					}
					var sAufnr = aInput[0];
					var sVornr = aInput[1];
					this.getView().byId("Aufnr").setValue(sAufnr);
					this.getView().byId("Vornr").setValue(sVornr);
					this.onSearch();
				}.bind(this), function(error) {
					sap.m.MessageBox.information(this.getResourceBundle().getText("messageBarcodeSysError"), {
						styleClass: "sapUiSizeCompact"
					});
				}.bind(this));
			} catch (err) {
				sap.m.MessageBox.information(this.getResourceBundle().getText("messageBarcodeSysError"), {
					styleClass: "sapUiSizeCompact"
				});
			}
		},
		onUploadPress: function(oEvent) {
			this._sNotifUploadPath = oEvent.getSource().getParent().getParent().getBindingContextPath();
			$("#pic-uploader").click();
		},
		onUploadDeletePress: function(oEvent) {
			var sNotifPath = oEvent.getSource().getParent().getParent().getBindingContextPath();
			var oNotif = this.oViewModel.getProperty(sNotifPath);
			oNotif.oPhoto = null;
			oNotif._showUpload = true;
			oNotif._showDelete = false;
			this.oViewModel.setProperty(sNotifPath, oNotif);
		},
		initDefaults: function() {
			this.getView().setBusy(true);
			this.getOwnerComponent().getModel().metadataLoaded().then(function() {
				var sObjectPath = this.getOwnerComponent().getModel().createKey("/DefaultSet", {
					id: "Default"
				});
				this.getOwnerComponent().getModel().read(sObjectPath, {
					success: function(oData) {
						this.oNotifDefault = oData;
						this.getView().setBusy(false);
					}.bind(this),
					error: function(oData) {
						sap.m.MessageBox.information(this.getResourceBundle().getText("messageDefaultsError"), {
							styleClass: "sapUiSizeCompact"
						});
						this.getView().setBusy(false);
					}.bind(this)
				});
			}.bind(this));
		},
		onSearch: function(oEvent) {
			if (this.oViewModel.getProperty("/notifications").length !== 0) {
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				sap.m.MessageBox.confirm(this.getResourceBundle().getText("messageSearchConfirm"), {
					styleClass: bCompact ? "sapUiSizeCompact" : "",
					onClose: function(sAction) {
						switch (sAction) {
							case "OK":
								this.oViewModel.setProperty("/notifications", []);
								this.readFauf();
								break;
							default:
						}
					}.bind(this)
				});
			} else {
				this.readFauf();
			}
		},
		readFauf: function() {
			this.getView().setBusy(true);
			var sObjectPath = this.getModel().createKey("/FaufSet", {
				ProdOrder: this.getView().byId("Aufnr").getValue(),
				Vornr: this.getView().byId("Vornr").getValue()
			});
			this.getModel().read(sObjectPath, {
				success: function(oData) {
					this.getView().setBusy(false);
					this.oAuftr = oData;
					var sPath = this.getModel().createKey("/FaufSet", {
						ProdOrder: this.getView().byId("Aufnr").getValue(),
						Vornr: this.getView().byId("Vornr").getValue()
					});
					this.getView().byId("details").bindElement(sPath);
					this.oViewModel.setProperty("/showDetails", true);
					this.oViewModel.setProperty("/showTable", true);
				}.bind(this),
				error: function(oData) {
					this.oViewModel.setProperty("/showDetails", false);
					this.oViewModel.setProperty("/showTable", false);
					this.getView().setBusy(false);
					//Nachricht ausgeben  
					this.getView().byId("details").unbindElement();
					sap.m.MessageBox.information(this.getResourceBundle().getText("messageSearchError"), {
						styleClass: "sapUiSizeCompact"
					});
				}.bind(this)
			});
		},
		onAddNotification: function(oEvent) {
			var aNotif = this.oViewModel.getProperty("/notifications");
			var oNotif = this.getNotifTemplate();
			oNotif.Pos = aNotif.length + 1;
			aNotif.push(oNotif);
			this.oViewModel.setProperty("/notifications", aNotif);
			//this.oTable.getItems().slice(-1)[0].getCells()[4].getBinding("items").filter(new sap.ui.model.Filter("CodeGroup", "EQ", oNotif.ArtGroup));
		},
		getNotifTemplate: function() {
			return {
				Pos: "",
				Text: "",
				Ort: this.oNotifDefault.FoCodeGroup + "|" + this.oNotifDefault.Fehlerort,
				ArtGroup: "", //this.oNotifDefault.FehlerartGroup,
				Art: "", //this.oNotifDefault.Fehlerart,
				Anz: 1,
				Klasse: this.oNotifDefault.Fehlerklasse,
				oPhoto: null,
				_showUpload: true,
				_showDelete: false
			};
		},
		onToDeleteNotification: function(oEvent) {
			if (this.oTable.getMode() === "None") {
				this.oTable.setMode("Delete");
			} else {
				this.oTable.setMode("None");
			}
		},
		onNotificationDelete: function(oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var sPath = oItem.getBindingContextPath();
			var aNotif = this.oViewModel.getProperty("/notifications");
			var oNotif = this.oViewModel.getProperty(sPath);
			var iIndex = aNotif.indexOf(oNotif);
			if (iIndex > -1) {
				aNotif.splice(iIndex, 1);
			}
			aNotif.forEach(function(oNotif, iIdx) {
				aNotif[iIdx].Pos = iIdx + 1;
			});
			this.oViewModel.setProperty("/notifications", aNotif);
		},
		onArtGroupChange: function(oEvent) {
			var oComboBox = oEvent.getSource();
			if (!oComboBox.getSelectedItem()) {
				oComboBox.setValueState("Error");
				oComboBox.setValueStateText(this.getResourceBundle().getText("messageErrorNoInput"));
				return;
			} else {
				oComboBox.setValueState("None");
				oComboBox.setValueStateText("");
			}
			var oFilter = new sap.ui.model.Filter("CodeGroup", "EQ", oComboBox.getSelectedItem().getKey());
			oEvent.getSource().getParent().getCells()[4].getBinding("items").filter([oFilter]);
		},
		onCancel: function() {
			this.oViewModel.setProperty("/notifications", []);
			this.getView().byId("Aufnr").setValue("");
			this.getView().byId("Vornr").setValue("");
			this.oViewModel.setProperty("/showDetails", false);
			this.oViewModel.setProperty("/showTable", false);
		},
		onSave: function() {
			var aNotif = this.oViewModel.getProperty("/notifications");
			if (aNotif.length === 0) {
				sap.m.MessageBox.information(this.getResourceBundle().getText("messageNoData"), {
					styleClass: "sapUiSizeCompact"
				});
				return;
			}
			var bValError = false;
			aNotif.forEach(function(oItem) {
				if (oItem.Art === "") {
					sap.m.MessageBox.information(this.getResourceBundle().getText("messageEmptyArt"), {
						styleClass: "sapUiSizeCompact"
					});
					bValError = true;
					return;
				}
			}.bind(this));

			if (bValError){
				return;
			}
				 
			this.oView.setBusy(true);
			var oModel = this.getModel();
			oModel.setRefreshAfterChange(false);
			var oData = {
				Aufnr: this.oAuftr.ProdOrder,
				Vornr: this.oAuftr.Vornr,
				//Aufnr: "1504816",
				//Vornr: "0050",
				Qmnum: "DUMMY",
				Items: [],
				Photos: []
			};
			aNotif.forEach(function(oItem) {
				oData.Items.push({
					Aufnr: this.oAuftr.ProdOrder,
					Vornr: this.oAuftr.Vornr,
					//Aufnr: "1504816",
					//Vornr: "0050",
					PosNr: oItem.Pos.toString(),
					Text: oItem.Text,
					LongText: oItem.LongText,
					FehlerartGroup: oItem.ArtGroup,
					Fehlerart: oItem.Art,
					Fehlerklasse: oItem.Klasse,
					FehlerOrtCodeGroup: oItem.Ort.split("|")[0],
					FehlerOrt: oItem.Ort.split("|")[1],
					Anz: parseInt(oItem.Anz)
				});
				if (oItem.oPhoto !== null && oItem.oPhoto !== undefined) {
					oData.Photos.push({
						DocumentName: oItem.oPhoto.name,
						DocumentType: oItem.oPhoto.name.split(".").pop().toLowerCase(),
						DocumentRaw: oItem.oPhoto.raw.replace(/^data:image\/(png|jpeg);base64,/, "")
					});
				}
			}, this);
			oModel.create("/NotifSet", oData, {
				success: function(oData) {
					this.oView.setBusy(false);
					this.oViewModel.setProperty("/notifications", []);
					this.getView().byId("Aufnr").setValue("");
					this.getView().byId("Vornr").setValue("");
					this.oViewModel.setProperty("/showDetails", false);
					this.oViewModel.setProperty("/showTable", false);
					sap.m.MessageToast.show(this.getResourceBundle().getText("messageSaveSuccess").replace("{1}", oData.Qmnum));
					/*	var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
										sap.m.MessageBox.success(
											this.getResourceBundle().getText("messageSaveSuccess").replace("{1}", oData.Qmnum), {
												styleClass: bCompact ? "sapUiSizeCompact" : ""
											}
										);*/
				}.bind(this),
				error: function(oData) {
					this.oView.setBusy(false);
					var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
					sap.m.MessageBox.error(JSON.parse(oData.responseText).error.message.value, {
						styleClass: bCompact ? "sapUiSizeCompact" : ""
					});
				}.bind(this)
			});
		},
		onCreateSuccess: function(oData) {
			this.oView.setBusy(false);
			//	this.oMessageManager.removeAllMessages();
			sap.m.MessageToast.show(this.getResourceBundle().getText("messageSuccess"));
		},
		onCreateError: function(oData) {
			this.oView.setBusy(false);
		},
		/**
		 *@memberOf egston.qm.ma.controller.Worklist
		 */
		onArtChange: function(oEvent) {

			var oComboBox = oEvent.getSource();
			if (!oComboBox.getSelectedItem()) {
				oComboBox.setValueState("Error");
				oComboBox.setValueStateText(this.getResourceBundle().getText("messageErrorNoInput"));
				return;
			} else {
				oComboBox.setValueState("None");
				oComboBox.setValueStateText("");
			}

		}
	});
});