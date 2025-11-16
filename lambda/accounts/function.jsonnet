local env = std.extVar('ENV');
local project_name = 'mizpos';

{
  FunctionName: env + '-' + project_name + '-accounts',
  Handler: 'main.handler',
  Runtime: 'python3.12',
  Timeout: 30,
  MemorySize: 256,
  Description: 'ユーザーアカウントとロール管理API',
}
