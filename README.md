# ILDHS_TierII
Illinois DHS Tier-II Report Generator

viewer/js/gis/dijit
  Paste TierII.js file
  Paste TierII folder

viewer/js/config/viewer.js

  Edit and paste this text in "widgets" section

      tierII: {
        include: true,
        id: 'tierII',
        type: 'invisible',
        path: 'gis/dijit/TierII',
        title: 'TierII',
        options: {}
      }
