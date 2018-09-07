define([
  'dojo/_base/declare',
  'dijit/_WidgetBase',

  'dojo/_base/lang',
  'dojo/json',
  'dojo/string',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/topic',
  'dojo/Deferred',
  'dojo/promise/all',

  'esri/tasks/QueryTask',
  'esri/tasks/query',
  'esri/tasks/RelationshipQuery',

  'dojo/text!./TierII/reports/newreport.html',
  'dojo/text!./TierII/testdata/newdata.json',

  './TierII/libs/Blob',
  './TierII/libs/FileSaver'
], function (
  declare, _WidgetBase,
  lang, json, string, array, domConstruct, topic, Deferred, all,
  QueryTask, Query, RelationshipQuery,
  reportTemplate, testData
 ) {

  return declare([_WidgetBase], {

    _started: false,
    _topicString: 'generateReport',

    queryUrl: '//gis.dhs.in.gov/arcgis/rest/services/OpenAccess/Tier2relates/MapServer/0',
    contactsId: 1,
    reportsId: 0,
    facilityField: 'FacilityID',

    postCreate: function () {
      this.inherited(arguments);

      // subscribe to "generateReport" arg=objectid
      this.own(topic.subscribe(this._topicString, lang.hitch(this, this.generateReport)));
    },

    startup: function () {
      console.log('TierII Startup');
      this._started = true;
    },

    _querySite: function (objectid) {
      var def = new Deferred();

      var queryTask = new QueryTask(this.queryUrl);

      var query = new Query();
      query.objectIds = [objectid];
      query.outFields = ['*'];

      queryTask.execute(query).then(
        //success
        function (featureSet) {
          if (featureSet && featureSet.features.length && featureSet.features[0]) {
            def.resolve(featureSet.features[0]);
          } else {
            def.resolve(null);
          }
        },
        //error
        function (err) {
          console.log(err.message);
          def.resolve(null);
        }
      );
      return def.promise;
    },

    _queryContacts: function (objectid) {
      var def = new Deferred();

      var queryTask = new QueryTask(this.queryUrl);

      var relQuery = new RelationshipQuery();
      relQuery.objectIds = [objectid];
      relQuery.outFields = ['*'];
      relQuery.relationshipId = this.contactsId;

      queryTask.executeRelationshipQuery(relQuery).then(
        //success
        function (featureSets) {
          if (featureSets && featureSets[objectid]) {
            def.resolve(featureSets[objectid].features); // each has attributes
          } else {
            def.resolve(null);
          }
        },
        //error
        function (err) {
          console.log(err.message);
          def.resolve(contacts);
        }
      );
      return def.promise;
    },

    _queryReports: function (objectid) {
      var def = new Deferred();

      var queryTask = new QueryTask(this.queryUrl);

      var relQuery = new RelationshipQuery();
      relQuery.objectIds = [objectid];
      relQuery.outFields = ['*'];
      relQuery.relationshipId = this.reportsId;

      queryTask.executeRelationshipQuery(relQuery).then(
        //success
        function (featureSets) {
          if (featureSets && featureSets[objectid]) {
            def.resolve(featureSets[objectid].features); // each has attributes
          } else {
            def.resolve(null);
          }
        },
        //error
        function (err) {
          console.log(err.message);
          def.resolve(null);
        }
      );
      return def.promise;
    },

    generateReport: function (objectid) {
      var defs = {
        'SITE': this._querySite(objectid),
        'CONTACTS': this._queryContacts(objectid),
        'REPORTS': this._queryReports(objectid)
      };

      var siteContactsReports = { 'site': null, 'contacts': null, 'reports': null };

      all(defs).then(
        //success
        lang.hitch(this, function (responses) {
          if (responses && responses.hasOwnProperty('SITE') && responses.SITE) {
            siteContactsReports.site = responses.SITE;
          }
          if (responses && responses.hasOwnProperty('CONTACTS') && responses.CONTACTS) {
            siteContactsReports.contacts = responses.CONTACTS;
          }
          if (responses && responses.hasOwnProperty('REPORTS') && responses.REPORTS) {
            siteContactsReports.reports = responses.REPORTS;
          }
          // format the server-data
          this._prepareReport(siteContactsReports);
        }),
        //error
        lang.hitch(this, function (err) {
          console.log(err.message || err);
          // format a warning report
          this._prepareReport(siteContactsReports);
        })
      );
    },

    _prepareReport: function (siteContactsReports) {
      var scr = siteContactsReports || json.parse(testData);

      var report = reportTemplate;
      var outName = 'Facility-';
      if (scr && scr.site && scr.site.attributes && scr.site.attributes.hasOwnProperty(this.facilityField)) {
        outName += scr.site.attributes[this.facilityField] || 'unknown';
      }
      outName += '.html';

      var lines = report.split('\n');
      var line;
      var output = "";
      var chemTemplate;
      var regTemplate;

      for (var x in lines) {
        line = lines[x];

        // check for chemRows
        if (line.indexOf('**chemRows**') > -1) {
          // get template after flag chemRow
          chemTemplate = line.substring(line.indexOf('**chemRows**') + '**chemRows**'.length);
          array.forEach(scr.reports, function (chem) {
            // compute comp_ehs based on IsEHS
            chem.attributes.comp_ehs = chem.attributes.Is_EHS === 0 ? 'Non-EHS' : 'EHS';

            for (var key in chem.attributes) {
              if (chem.attributes.hasOwnProperty(key) && chem.attributes[key] === null) {
                chem.attributes[key] = 'null';
              }
            }

            line = string.substitute(chemTemplate, chem.attributes);
            output += line;
          }, this);

          // check for regRows
        } else if (line.indexOf('**regRows**') > -1) {
          // get template after flag regRows
          regTemplate = line.substring(line.indexOf('**regRows**') + '**regRows**'.length);
          array.forEach(scr.contacts, function (cont) {

            for (var key in cont.attributes) {
              if (cont.attributes.hasOwnProperty(key) && cont.attributes[key] === null) {
                cont.attributes[key] = 'null';
              }
            }

            line = string.substitute(regTemplate, this._attsToPhone(cont.attributes));
            output += line;
          }, this);

          // regular row of template row
        } else {
          if (lines[x].indexOf('${') > -1) {
            line = string.substitute(lines[x], scr.site.attributes);
            output += line;
          } else {
            output += line;
          }
        }
      }

      var blob = new Blob([output], { type: "text/html;charset=utf-8" });
      saveAs(blob, outName);
    },

    _attsToPhone: function (atts) {
      for (var key in atts) {
        if (atts.hasOwnProperty(key) && atts[key] && typeof atts[key] === 'number' && atts[key].toString().length === 10) {
          atts[key] = atts[key].toString();
          atts[key] = atts[key].substring(0, 3) + '-' + atts[key].substring(3, 6) + '-' + atts[key].substring(6);
        }
      }
      return atts;
    },

    noComma: null
  });
});