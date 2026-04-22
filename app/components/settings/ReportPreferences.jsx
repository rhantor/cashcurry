/* eslint-disable react/prop-types */
import React from "react";

const ReportPreferences = ({ reportPrefs, setReportPrefs }) => {
  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Report Preferences</h2>

      <div>
        <label className="block text-sm font-medium">Currency</label>
        <input
          type="text"
          className="w-full border rounded p-2"
          value={reportPrefs.currency}
          onChange={(e) =>
            setReportPrefs({ ...reportPrefs, currency: e.target.value })
          }
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Default Date Range</label>
        <input
          type="text"
          className="w-full border rounded p-2"
          value={reportPrefs.dateRange}
          onChange={(e) =>
            setReportPrefs({ ...reportPrefs, dateRange: e.target.value })
          }
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Timezone</label>
        <input
          type="text"
          className="w-full border rounded p-2"
          value={reportPrefs.timezone}
          onChange={(e) =>
            setReportPrefs({ ...reportPrefs, timezone: e.target.value })
          }
        />
      </div>
    </div>
  );
};

export default ReportPreferences;
