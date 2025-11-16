local env = std.extVar('ENV');
local project_name = 'mizpos';

{
  FunctionName: env + '-' + project_name + '-stock',
  Handler: 'main.handler',
  Runtime: 'python3.12',
  Timeout: 30,
  MemorySize: 256,
  Description: '在庫管理・商品情報管理API',
}
