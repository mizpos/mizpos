local env = std.extVar('ENV');
local project_name = 'mizpos';

{
  FunctionName: env + '-' + project_name + '-sales',
  Handler: 'main.handler',
  Runtime: 'python3.12',
  Timeout: 30,
  MemorySize: 512,
  Description: '販売・決済処理API（Stripe統合）',
}
