import React from 'react'
import { Method, CustomEquipment } from '@/lib/core/config'

interface MethodPreviewCardProps {
    method: Method
    customEquipment?: CustomEquipment
}

const MethodPreviewCard: React.FC<MethodPreviewCardProps> = () => {
    return (
        <div className="w-full max-w-md aspect-square bg-white dark:bg-neutral-900 flex items-center justify-center">
            <div className="text-xl text-neutral-500 dark:text-neutral-400">
                开发中...
            </div>
        </div>
    )
}

export default MethodPreviewCard 