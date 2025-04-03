import React, { useState } from 'react';
import { CustomEquipment } from '@/lib/config';
import { isEquipmentNameAvailable } from '@/lib/customEquipments';

interface CustomEquipmentFormProps {
    onSave: (equipment: CustomEquipment) => void;
    onCancel: () => void;
    initialEquipment?: CustomEquipment;
}

// 动画类型选项
const ANIMATION_TYPES = [
    { value: 'v60', label: 'V60 风格' },
    { value: 'kalita', label: '蛋糕杯风格' },
    { value: 'origami', label: '折纸风格' },
    { value: 'clever', label: '聪明杯风格' },
] as const;

// 表单字段组件
interface FormFieldProps {
    label: string;
    error?: string;
    children: React.ReactNode;
    hint?: string;
}

const FormField: React.FC<FormFieldProps> = ({ label, error, children, hint }) => (
    <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {label}
        </label>
        {children}
        {hint && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {hint}
            </p>
        )}
        {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
    </div>
);

const CustomEquipmentForm: React.FC<CustomEquipmentFormProps> = ({
    onSave,
    onCancel,
    initialEquipment
}) => {
    const [equipment, setEquipment] = useState<Partial<CustomEquipment>>({
        name: '',
        description: '',
        note: '',
        animationType: 'v60',
        hasValve: false,
        ...initialEquipment
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 更新表单字段值的处理函数
    const handleChange = <K extends keyof CustomEquipment>(
        key: K, 
        value: CustomEquipment[K]
    ) => {
        setEquipment(prev => ({ ...prev, [key]: value }));
    };

    // 验证表单
    const validateForm = async () => {
        const newErrors: Record<string, string> = {};

        if (!equipment.name?.trim()) {
            newErrors.name = '请输入器具名称';
        } else if (!(await isEquipmentNameAvailable(equipment.name, initialEquipment?.id))) {
            newErrors.name = '器具名称已存在';
        }

        if (!equipment.description?.trim()) {
            newErrors.description = '请输入器具描述';
        }

        if (!equipment.animationType) {
            newErrors.animationType = '请选择动画类型';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // 处理表单提交
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (await validateForm()) {
                onSave({
                    ...equipment as CustomEquipment,
                    isCustom: true,
                });
            }
        } catch (error) {
            console.error('保存器具失败:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* 器具名称 */}
            <FormField label="器具名称" error={errors.name}>
                <input
                    type="text"
                    value={equipment.name || ''}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                    placeholder="例如：双层滤杯"
                />
            </FormField>

            {/* 器具描述 */}
            <FormField label="器具描述" error={errors.description}>
                <textarea
                    value={equipment.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                    placeholder="描述器具的特点和用途"
                />
            </FormField>

            {/* 备注（可选） */}
            <FormField label="备注（可选）">
                <textarea
                    value={equipment.note || ''}
                    onChange={(e) => handleChange('note', e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                    placeholder="添加额外的说明信息"
                />
            </FormField>

            {/* 动画类型 */}
            <FormField 
                label="动画类型" 
                error={errors.animationType}
                hint="此选项将决定冲煮过程中的可视化动画效果"
            >
                <select
                    value={equipment.animationType || 'v60'}
                    onChange={(e) => handleChange(
                        'animationType', 
                        e.target.value as CustomEquipment['animationType']
                    )}
                    className="mt-1 block w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 dark:text-white"
                >
                    {ANIMATION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>
            </FormField>

            {/* 阀门控制 */}
            <div className="flex items-center">
                <input
                    type="checkbox"
                    id="hasValve"
                    checked={equipment.hasValve || false}
                    onChange={(e) => handleChange('hasValve', e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <label
                    htmlFor="hasValve"
                    className="ml-2 block text-sm text-neutral-700 dark:text-neutral-300"
                >
                    支持阀门控制（类似聪明杯）
                </label>
            </div>

            {/* 按钮组 */}
            <div className="flex justify-end space-x-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                >
                    取消
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                >
                    {isSubmitting ? '保存中...' : '保存'}
                </button>
            </div>
        </form>
    );
};

export default CustomEquipmentForm; 