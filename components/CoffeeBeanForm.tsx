'use client'

import React from 'react';
import { ExtendedCoffeeBean } from './CoffeeBean/Form/types';
import CoffeeBeanFormContent from './CoffeeBean/Form';

interface CoffeeBeanFormProps {
    onSave: (bean: Omit<ExtendedCoffeeBean, 'id' | 'timestamp'>) => void;
    onCancel: () => void;
    initialBean?: ExtendedCoffeeBean;
}

const CoffeeBeanForm: React.FC<CoffeeBeanFormProps> = ({
    onSave,
    onCancel,
    initialBean,
}) => {
    return (
        <CoffeeBeanFormContent
            onSave={onSave}
            onCancel={onCancel}
            initialBean={initialBean}
        />
    );
};

export default CoffeeBeanForm; 