local env = std.extVar('ENV');
local project_name = 'mizpos';

{
  FunctionName: env + '-' + project_name + '-pos',
  Handler: 'main.handler',
  Runtime: 'python3.12',
  Timeout: 30,
  MemorySize: 256,
  Description: 'POS端末専用API（端末認証・従業員認証・販売処理）',
}
