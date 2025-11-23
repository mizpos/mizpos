export interface paths {
  "/signup-urls": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["create_signup_url_signup_urls_post"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/enterprises": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["list_enterprises_enterprises_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/enterprises/{enterprise_id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["get_enterprise_enterprises__enterprise_id__get"];
    put?: never;
    post?: never;
    delete: operations["delete_enterprise_enterprises__enterprise_id__delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/enterprises/{enterprise_id}/callback": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["enterprise_callback_enterprises__enterprise_id__callback_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/policies": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["list_policies_policies_get"];
    put?: never;
    post: operations["create_policy_policies_post"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/policies/{policy_id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["get_policy_policies__policy_id__get"];
    put: operations["update_policy_policies__policy_id__put"];
    post?: never;
    delete: operations["delete_policy_policies__policy_id__delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/devices": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["list_devices_devices_get"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/devices/{device_id}": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["get_device_devices__device_id__get"];
    put?: never;
    post?: never;
    delete: operations["delete_device_devices__device_id__delete"];
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/devices/{device_id}/command": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["send_device_command_devices__device_id__command_post"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    SignupUrlRequest: {
      callback_url: string;
      project_id: string;
    };
    SignupUrlResponse: {
      url: string;
      name: string;
    };
    Enterprise: {
      id: string;
      name: string;
      enterprise_display_name?: string;
      enabled_notification_types?: string[];
      created_at: string;
      updated_at?: string;
    };
    EnterpriseListResponse: {
      enterprises: components["schemas"]["Enterprise"][];
    };
    Policy: {
      id: string;
      enterprise_id: string;
      name: string;
      policy_data: Record<string, unknown>;
      created_at: string;
      updated_at?: string;
    };
    PolicyCreateRequest: {
      enterprise_id: string;
      name: string;
      policy_data: Record<string, unknown>;
    };
    PolicyUpdateRequest: {
      name?: string;
      policy_data?: Record<string, unknown>;
    };
    PolicyListResponse: {
      policies: components["schemas"]["Policy"][];
    };
    Device: {
      id: string;
      enterprise_id: string;
      name: string;
      state: string;
      applied_policy_name?: string;
      enrollment_time?: string;
      last_status_report_time?: string;
      hardware_info?: Record<string, unknown>;
      software_info?: Record<string, unknown>;
      created_at: string;
      updated_at?: string;
    };
    DeviceListResponse: {
      devices: components["schemas"]["Device"][];
    };
    DeviceCommandRequest: {
      command_type: "LOCK" | "REBOOT" | "RESET_PASSWORD" | "WIPE";
      new_password?: string;
    };
    DeviceCommandResponse: {
      success: boolean;
      message: string;
    };
    HTTPValidationError: {
      detail?: components["schemas"]["ValidationError"][];
    };
    ValidationError: {
      loc: (string | number)[];
      msg: string;
      type: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export interface operations {
  create_signup_url_signup_urls_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["SignupUrlRequest"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["SignupUrlResponse"];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  list_enterprises_enterprises_get: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["EnterpriseListResponse"];
        };
      };
    };
  };
  get_enterprise_enterprises__enterprise_id__get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        enterprise_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Enterprise"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
    };
  };
  delete_enterprise_enterprises__enterprise_id__delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        enterprise_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { success: boolean };
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
    };
  };
  enterprise_callback_enterprises__enterprise_id__callback_get: {
    parameters: {
      query: {
        enterpriseToken: string;
      };
      header?: never;
      path: {
        enterprise_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Enterprise"];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  list_policies_policies_get: {
    parameters: {
      query?: {
        enterprise_id?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["PolicyListResponse"];
        };
      };
    };
  };
  create_policy_policies_post: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["PolicyCreateRequest"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Policy"];
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  get_policy_policies__policy_id__get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        policy_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Policy"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
    };
  };
  update_policy_policies__policy_id__put: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        policy_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["PolicyUpdateRequest"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Policy"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
  delete_policy_policies__policy_id__delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        policy_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { success: boolean };
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
    };
  };
  list_devices_devices_get: {
    parameters: {
      query?: {
        enterprise_id?: string;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["DeviceListResponse"];
        };
      };
    };
  };
  get_device_devices__device_id__get: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        device_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["Device"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
    };
  };
  delete_device_devices__device_id__delete: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        device_id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { success: boolean };
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
    };
  };
  send_device_command_devices__device_id__command_post: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        device_id: string;
      };
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["DeviceCommandRequest"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["DeviceCommandResponse"];
        };
      };
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": { detail: string };
        };
      };
      422: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["HTTPValidationError"];
        };
      };
    };
  };
}
