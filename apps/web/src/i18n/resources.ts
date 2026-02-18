import en_common from "./locales/en/common.json";
import en_dashboard from "./locales/en/dashboard.json";
import en_upload from "./locales/en/upload.json";
import en_forecast from "./locales/en/forecast.json";
import en_cashflow from "./locales/en/cashflow.json";
import en_settings from "./locales/en/settings.json";
import en_dataQuality from "./locales/en/data-quality.json";
import en_insights from "./locales/en/insights.json";
import en_errors from "./locales/en/errors.json";

import es_common from "./locales/es/common.json";
import es_dashboard from "./locales/es/dashboard.json";
import es_upload from "./locales/es/upload.json";
import es_forecast from "./locales/es/forecast.json";
import es_cashflow from "./locales/es/cashflow.json";
import es_settings from "./locales/es/settings.json";
import es_dataQuality from "./locales/es/data-quality.json";
import es_insights from "./locales/es/insights.json";
import es_errors from "./locales/es/errors.json";

import fr_common from "./locales/fr/common.json";
import fr_dashboard from "./locales/fr/dashboard.json";
import fr_upload from "./locales/fr/upload.json";
import fr_forecast from "./locales/fr/forecast.json";
import fr_cashflow from "./locales/fr/cashflow.json";
import fr_settings from "./locales/fr/settings.json";
import fr_dataQuality from "./locales/fr/data-quality.json";
import fr_insights from "./locales/fr/insights.json";
import fr_errors from "./locales/fr/errors.json";

import zh_common from "./locales/zh/common.json";
import zh_dashboard from "./locales/zh/dashboard.json";
import zh_upload from "./locales/zh/upload.json";
import zh_forecast from "./locales/zh/forecast.json";
import zh_cashflow from "./locales/zh/cashflow.json";
import zh_settings from "./locales/zh/settings.json";
import zh_dataQuality from "./locales/zh/data-quality.json";
import zh_insights from "./locales/zh/insights.json";
import zh_errors from "./locales/zh/errors.json";

export const resources = {
  en: {
    common: en_common,
    dashboard: en_dashboard,
    upload: en_upload,
    forecast: en_forecast,
    cashflow: en_cashflow,
    settings: en_settings,
    "data-quality": en_dataQuality,
    insights: en_insights,
    errors: en_errors,
  },
  es: {
    common: es_common,
    dashboard: es_dashboard,
    upload: es_upload,
    forecast: es_forecast,
    cashflow: es_cashflow,
    settings: es_settings,
    "data-quality": es_dataQuality,
    insights: es_insights,
    errors: es_errors,
  },
  fr: {
    common: fr_common,
    dashboard: fr_dashboard,
    upload: fr_upload,
    forecast: fr_forecast,
    cashflow: fr_cashflow,
    settings: fr_settings,
    "data-quality": fr_dataQuality,
    insights: fr_insights,
    errors: fr_errors,
  },
  zh: {
    common: zh_common,
    dashboard: zh_dashboard,
    upload: zh_upload,
    forecast: zh_forecast,
    cashflow: zh_cashflow,
    settings: zh_settings,
    "data-quality": zh_dataQuality,
    insights: zh_insights,
    errors: zh_errors,
  },
} as const;
