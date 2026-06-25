import React, { useState } from 'react';
import { Select } from './Form';
import { Combobox } from './Combobox';

/**
 * 独立测试页面：用于测试 Select 和 Combobox 组件
 * 
 * 使用方法：
 * 1. 在 App.tsx 中导入此组件
 * 2. 临时替换主内容为 <SelectComboboxTest />
 * 3. 打开浏览器控制台
 * 4. 测试各个组件的选择功能
 */
export const SelectComboboxTest: React.FC = () => {
  const [selectValue, setSelectValue] = useState('');
  const [comboboxValue, setComboboxValue] = useState('');
  const [groupedComboboxValue, setGroupedComboboxValue] = useState('');

  const selectOptions = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  const comboboxOptions = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];

  const groupedComboboxOptions = [
    { label: '2024', options: ['Project A 2024', 'Project B 2024'] },
    { label: '2023', options: ['Project C 2023', 'Project D 2023'] },
    { label: '2022', options: ['Project E 2022', 'Project F 2022'] },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Select & Combobox 测试页面</h1>
          <p className="text-gray-600 mb-4">
            打开浏览器控制台（F12）查看调试日志
          </p>
        </div>

        {/* Test 1: Basic Select */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">测试 1：基础 Select 组件</h2>
          <div className="space-y-4">
            <Select
              label="选择一个选项"
              options={selectOptions}
              value={selectValue}
              onChange={(e) => {
                console.log('[Test] Select onChange received:', e.target.value);
                setSelectValue(e.target.value);
              }}
            />
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm font-mono">
                当前值: <span className="font-bold text-blue-600">{selectValue || '(未选择)'}</span>
              </p>
            </div>
            <button
              onClick={() => {
                console.log('[Test] Resetting select value');
                setSelectValue('');
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              重置
            </button>
          </div>
        </div>

        {/* Test 2: Basic Combobox */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">测试 2：基础 Combobox 组件</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择或输入水果名称
              </label>
              <Combobox
                options={comboboxOptions}
                value={comboboxValue}
                onChange={(value) => {
                  console.log('[Test] Combobox onChange received:', value);
                  setComboboxValue(value);
                }}
                placeholder="选择或输入..."
              />
            </div>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm font-mono">
                当前值: <span className="font-bold text-blue-600">{comboboxValue || '(未选择)'}</span>
              </p>
            </div>
            <button
              onClick={() => {
                console.log('[Test] Resetting combobox value');
                setComboboxValue('');
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              重置
            </button>
          </div>
        </div>

        {/* Test 3: Grouped Combobox */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">测试 3：分组 Combobox 组件</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择项目（按年份分组）
              </label>
              <Combobox
                groupedOptions={groupedComboboxOptions}
                value={groupedComboboxValue}
                onChange={(value) => {
                  console.log('[Test] Grouped Combobox onChange received:', value);
                  setGroupedComboboxValue(value);
                }}
                placeholder="选择项目..."
              />
            </div>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm font-mono">
                当前值: <span className="font-bold text-blue-600">{groupedComboboxValue || '(未选择)'}</span>
              </p>
            </div>
            <button
              onClick={() => {
                console.log('[Test] Resetting grouped combobox value');
                setGroupedComboboxValue('');
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              重置
            </button>
          </div>
        </div>

        {/* Test 4: Rapid Selection Test */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">测试 4：快速连续选择测试</h2>
          <p className="text-sm text-gray-600 mb-4">
            快速连续选择不同的选项，观察是否每次都能正确更新
          </p>
          <div className="space-y-4">
            <Select
              label="快速选择测试"
              options={[
                { value: 'a', label: 'A' },
                { value: 'b', label: 'B' },
                { value: 'c', label: 'C' },
                { value: 'd', label: 'D' },
                { value: 'e', label: 'E' },
              ]}
              value={selectValue}
              onChange={(e) => {
                console.log('[Test] Rapid select onChange:', e.target.value);
                setSelectValue(e.target.value);
              }}
            />
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm font-mono">
                选择次数: <span className="font-bold text-blue-600" id="select-count">0</span>
              </p>
              <p className="text-sm font-mono mt-2">
                当前值: <span className="font-bold text-blue-600">{selectValue || '(未选择)'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">测试说明</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>打开浏览器控制台（按 F12）</li>
            <li>清空控制台日志</li>
            <li>依次测试每个组件：
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>点击下拉框</li>
                <li>选择一个选项</li>
                <li>观察控制台日志</li>
                <li>检查显示的值是否正确</li>
              </ul>
            </li>
            <li>如果发现问题，记录：
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>哪个组件有问题</li>
                <li>控制台的完整日志</li>
                <li>显示的值 vs 预期的值</li>
              </ul>
            </li>
          </ol>
        </div>

        {/* Expected Console Output */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">预期的控制台输出</h3>
          <div className="bg-white p-4 rounded font-mono text-xs space-y-1">
            <p className="text-gray-600">// 当你选择 Select 选项时：</p>
            <p>[Select] Option clicked: option1</p>
            <p>[Select] Calling onChange with: &#123;target: &#123;value: "option1", name: ""&#125;&#125;</p>
            <p>[Select] props.onChange exists? true</p>
            <p>[Select] Closing dropdown</p>
            <p className="text-blue-600">[Test] Select onChange received: option1</p>
            <p>[Select] Props changed: &#123;value: "option1", selectedOption: &#123;...&#125;, options: [...]&#125;</p>
            
            <p className="text-gray-600 mt-4">// 当你选择 Combobox 选项时：</p>
            <p>[Combobox] handleSelect called: &#123;val: "Apple", currentValue: "", currentInputValue: ""&#125;</p>
            <p>[Combobox] Calling onChange with: Apple</p>
            <p>[Combobox] Closing dropdown</p>
            <p className="text-blue-600">[Test] Combobox onChange received: Apple</p>
          </div>
        </div>
      </div>
    </div>
  );
};
