import type { CoffeeBean } from '@/types/app';

export const createRoastingCopyTemplate = (
  greenBean: CoffeeBean,
  roastedBean: CoffeeBean | undefined,
  roastedAmount: number,
  roastDate = new Date().toISOString().split('T')[0]
): Omit<CoffeeBean, 'id' | 'timestamp'> => {
  const amount = String(roastedAmount);

  return {
    name: greenBean.name,
    roaster: roastedBean?.roaster || greenBean.roaster,
    beanState: 'roasted',
    beanType: roastedBean?.beanType || greenBean.beanType,
    capacity: amount,
    // The source record only stores the green-bean amount. Starting with equal
    // values avoids creating an unrecorded loss/decrement when the copy saves.
    remaining: amount,
    image: roastedBean?.image || greenBean.image,
    backImage: roastedBean?.backImage || greenBean.backImage,
    roastLevel: roastedBean?.roastLevel || '',
    roastDate,
    flavor: roastedBean?.flavor || greenBean.flavor,
    notes: roastedBean?.notes || greenBean.notes,
    brand: roastedBean?.brand || greenBean.brand,
    price: '',
    blendComponents: roastedBean?.blendComponents || greenBean.blendComponents,
    sourceGreenBeanId: greenBean.id,
  };
};
