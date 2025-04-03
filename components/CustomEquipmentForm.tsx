import React, { useState } from 'react';
import { CustomEquipment } from '@/lib/config';
import { isEquipmentNameAvailable } from '@/lib/customEquipments';
import DrawingModal from './DrawingModal';

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
        customShapeSvg: '',
        ...initialEquipment
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDrawingModal, setShowDrawingModal] = useState(false);

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
                const equipmentToSave = {
                    ...equipment as CustomEquipment,
                    isCustom: true as const,
                };
                
                // 检查杯型SVG数据是否存在
                if (equipmentToSave.customShapeSvg) {
                    console.log('保存设备时包含自定义杯型SVG，长度:', 
                        equipmentToSave.customShapeSvg.length);
                }
                
                onSave(equipmentToSave);
            }
        } catch (error) {
            console.error('保存器具失败:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 处理杯型绘制完成
    const handleDrawingComplete = (svg: string) => {
        console.log('杯型绘制完成，获取到SVG数据，长度:', svg.length);
        if (svg && svg.trim() !== '') {
            setEquipment(prev => ({
                ...prev,
                customShapeSvg: svg
            }));
            console.log('已保存自定义杯型SVG到设备数据中');
        } else {
            console.error('绘制完成但SVG数据为空');
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

            {/* 自定义杯型 */}
            <FormField 
                label="自定义杯型" 
                hint="绘制您的自定义杯型，将在冲煮过程中显示"
            >
                <div className="mt-1 flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => setShowDrawingModal(true)}
                        className="inline-flex items-center px-3 py-2 border border-neutral-300 dark:border-neutral-700 shadow-sm text-sm leading-4 font-medium rounded-md text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M4 20H8L18.5 9.5C19.0304 8.96956 19.3284 8.2582 19.3284 7.5142C19.3284 6.7702 19.0304 6.05884 18.5 5.52839C17.9696 4.99794 17.2582 4.7 16.5142 4.7C15.7702 4.7 15.0588 4.99794 14.5284 5.52839L4 16V20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M13.5 6.5L17.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {equipment.customShapeSvg ? '修改自定义杯型' : '绘制自定义杯型'}
                    </button>
                    {equipment.customShapeSvg && (
                        <div className="text-sm text-green-600 dark:text-green-400 flex items-center">
                            <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 13L9 17L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            已保存自定义杯型
                        </div>
                    )}
                </div>
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

            {/* 绘图模态框 */}
            <DrawingModal
                isOpen={showDrawingModal}
                onClose={() => setShowDrawingModal(false)}
                onSave={handleDrawingComplete}
                defaultSvg={equipment.customShapeSvg}
            />
        </form>
    );
};

export default CustomEquipmentForm; 